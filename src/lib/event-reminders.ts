import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { readJSON, writeJSON } from "./local-storage";
import type { Booking } from "./api";

const REGISTRY_KEY = "giggifi_event_reminders";

type OffsetKey = "7d" | "24h" | "3h";

const OFFSETS: { key: OffsetKey; ms: number; label: string; interruptionLevel?: "timeSensitive" }[] = [
  { key: "7d", ms: 7 * 24 * 60 * 60 * 1000, label: "in 7 days" },
  { key: "24h", ms: 24 * 60 * 60 * 1000, label: "tomorrow" },
  // Time-sensitive so it can break through iOS Focus modes — this is the
  // one reminder that's genuinely useless if silently held back.
  { key: "3h", ms: 3 * 60 * 60 * 1000, label: "in 3 hours", interruptionLevel: "timeSensitive" },
];

// Booking statuses that count as "confirmed, event hasn't happened yet" —
// see src/lib/booking-status.ts. Anything else (cancelled, completed,
// disputed, paid out) means any existing reminders should be cancelled.
// Exported since src/app/(tabs)/bookings.tsx also needs it, to decide
// whether the OEM battery-optimization card is worth showing at all.
export const CONFIRMED_STATUSES = new Set(["PAYMENT_HELD", "EVENT_UPCOMING"]);

interface RegistryEntry {
  eventDate: string;
  identifiers: Partial<Record<OffsetKey, string>>;
}
type ReminderRegistry = Record<string, RegistryEntry>;

function getRegistry(): Promise<ReminderRegistry> {
  return readJSON<ReminderRegistry>(REGISTRY_KEY, {});
}

async function cancelEntry(bookingId: string, registry: ReminderRegistry): Promise<void> {
  const entry = registry[bookingId];
  if (!entry) return;
  await Promise.all(
    Object.values(entry.identifiers)
      .filter((id): id is string => Boolean(id))
      .map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})),
  );
  delete registry[bookingId];
}

async function scheduleEntry(booking: Booking, registry: ReminderRegistry): Promise<void> {
  const existing = registry[booking.id];
  if (existing && existing.eventDate === booking.eventDate) return; // already scheduled for this exact date
  if (existing) await cancelEntry(booking.id, registry); // eventDate moved — start clean

  const eventTime = new Date(booking.eventDate).getTime();
  if (!Number.isFinite(eventTime)) return;

  const identifiers: Partial<Record<OffsetKey, string>> = {};
  for (const offset of OFFSETS) {
    const triggerTime = eventTime - offset.ms;
    if (triggerTime <= Date.now()) continue; // that lead time has already passed — don't schedule it
    try {
      identifiers[offset.key] = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${booking.eventName} is ${offset.label}`,
          body: `Your GiggiFi booking in ${booking.eventCity} is coming up.`,
          data: { actionUrl: `/booking/${booking.id}`, category: "EVENT_DAY" },
          ...(offset.interruptionLevel ? { interruptionLevel: offset.interruptionLevel } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerTime), channelId: "event_day" },
      });
    } catch {
      // One offset failing to schedule shouldn't block the others.
    }
  }
  registry[booking.id] = { eventDate: booking.eventDate, identifiers };
}

// Reconciles local (offline-capable) event-day reminders against the
// current booking list — called wherever the app already fetches the full
// list (see src/app/(tabs)/bookings.tsx), not per-screen, so a booking the
// user never re-opens still gets scheduled/cancelled correctly.
//
// expo-notifications' scheduler has no web implementation at all (confirmed
// via node_modules/expo-notifications/src/NotificationScheduler.ts — the
// web-resolved module only stubs addListener/removeListeners) and throws
// UnavailabilityError if called, so this no-ops entirely on web.
export async function reconcileEventReminders(bookings: Booking[]): Promise<void> {
  if (Platform.OS === "web") return;

  const registry = await getRegistry();
  const activeIds = new Set(bookings.map((b) => b.id));
  for (const id of Object.keys(registry)) {
    if (!activeIds.has(id)) delete registry[id];
  }

  for (const booking of bookings) {
    if (CONFIRMED_STATUSES.has(booking.status)) {
      await scheduleEntry(booking, registry);
    } else if (registry[booking.id]) {
      await cancelEntry(booking.id, registry);
    }
  }

  await writeJSON(REGISTRY_KEY, registry);
}
