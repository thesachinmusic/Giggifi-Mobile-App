import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { OemDeliveryCard } from "@/components/OemDeliveryCard";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchBookings, fetchRegulars, type Booking, type RegularArtistEntry } from "@/lib/api";
import { CONFIRMED_STATUSES, reconcileEventReminders } from "@/lib/event-reminders";
import { hapticSelect } from "@/lib/haptics";
import { getOemGuidance, type OemGuidance } from "@/lib/oem-delivery";
import { hasSeenOemCard, markOemCardSeen } from "@/lib/oem-guidance-storage";
import { duotoneFor } from "@/lib/palette";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, spacing, radii } from "@/theme";

type BookingFilter = "all" | "upcoming" | "completed" | "cancelled";

const FILTER_TABS: { key: BookingFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const UPCOMING_STATUSES = new Set([
  "ENQUIRY_SENT", "ENQUIRY_VIEWED", "QUOTE_RECEIVED", "QUOTE_ACCEPTED",
  "AWAITING_PAYMENT", "PAYMENT_HELD", "EVENT_UPCOMING", "PAYOUT_PROCESSING",
]);
const COMPLETED_STATUSES = new Set(["EVENT_COMPLETED", "PAYOUT_RELEASED", "RESOLVED"]);
const CANCELLED_STATUSES = new Set(["CANCELLED_BY_ARTIST", "CANCELLED_BY_BOOKER", "DISPUTED"]);

function matchesFilter(status: string, filter: BookingFilter): boolean {
  if (filter === "all") return true;
  if (filter === "upcoming") return UPCOMING_STATUSES.has(status);
  if (filter === "completed") return COMPLETED_STATUSES.has(status);
  return CANCELLED_STATUSES.has(status);
}

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [oemGuidance, setOemGuidance] = useState<OemGuidance | null>(null);
  const [filter, setFilter] = useState<BookingFilter>("all");

  // "Your Regulars" — artists with 2+ completed bookings with this client in
  // the last 6 months. Always the live server-computed list (see
  // /api/mobile/bookings/regulars) — loaded independently of `bookings`
  // above so a slow/failed regulars fetch never blocks the booking list
  // itself from showing.
  const [regulars, setRegulars] = useState<RegularArtistEntry[]>([]);
  const [regularsLoading, setRegularsLoading] = useState(true);

  // setLoading(false) only ever fires here, never reset to true afterwards —
  // so the first call (on initial mount, since useFocusEffect below fires
  // then too) shows the full-screen spinner, and every later call just
  // updates the list quietly in place instead of re-blocking the screen.
  const load = useCallback(async () => {
    setError("");
    try {
      const { bookings: results } = await fetchBookings();
      setBookings(results);
      reconcileEventReminders(results).catch((err) => captureError(err, "event-reminders-reconcile"));
      maybeShowOemCard(results);
    } catch {
      setError("Couldn't load your bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRegulars = useCallback(async () => {
    try {
      const { regulars: results } = await fetchRegulars();
      setRegulars(results);
    } catch (err) {
      captureError(err, "bookings-regulars-fetch");
    } finally {
      setRegularsLoading(false);
    }
  }, []);

  // Only worth interrupting the user about background-delivery quirks if
  // there's an actual upcoming booking whose reminders/pushes could get
  // silently eaten, notifications are already on, this is a known
  // aggressive-killer OEM, and they haven't seen this card before.
  async function maybeShowOemCard(results: Booking[]) {
    const guidance = getOemGuidance();
    if (!guidance) return;
    if (!results.some((b) => CONFIRMED_STATUSES.has(b.status))) return;
    const [{ status }, seen] = await Promise.all([Notifications.getPermissionsAsync(), hasSeenOemCard()]);
    if (status !== "granted" || seen) return;
    setOemGuidance(guidance);
  }

  function dismissOemCard() {
    setOemGuidance(null);
    markOemCardSeen().catch((err) => captureError(err, "oem-card-mark-seen"));
  }

  // Refreshes every time this tab is focused — e.g. after paying for a
  // booking on its detail screen and coming back here, or after a Book
  // Again completes and a completed booking becomes a fresh regular.
  useFocusEffect(
    useCallback(() => {
      load();
      loadRegulars();
    }, [load, loadRegulars]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([load(), loadRegulars()]);
    setRefreshing(false);
  }

  const visibleBookings = useMemo(() => bookings.filter((b) => matchesFilter(b.status, filter)), [bookings, filter]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.title}>Bookings</Text>

        {oemGuidance ? (
          <View style={styles.oemCardWrap}>
            <OemDeliveryCard guidance={oemGuidance} onDismiss={dismissOemCard} />
          </View>
        ) : null}

        {!loading && !(error && bookings.length === 0) && bookings.length > 0 ? (
          <RegularsSection loading={regularsLoading} regulars={regulars} />
        ) : null}

        {!loading && !(error && bookings.length === 0) ? (
          <View style={styles.filterRow}>
            {FILTER_TABS.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => { hapticSelect(); setFilter(tab.key); }}
                style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
              >
                <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <GlassCard key={i} style={styles.card}>
                <View style={styles.row}>
                  <Skeleton width="55%" height={16} />
                  <Skeleton width={70} height={20} borderRadius={radii.pill} />
                </View>
                <Skeleton width="40%" height={12} />
                <Skeleton width="35%" height={12} />
              </GlassCard>
            ))}
          </View>
        ) : error && bookings.length === 0 ? (
          // Only block on error before any data has loaded — a later
          // background refresh failure (focus, pull-to-refresh) shouldn't
          // blank out an already-populated list.
          <ScrollView
            contentContainerStyle={styles.errorScroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.pink} />}
          >
            <Text style={styles.muted}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <FlatList
            data={visibleBookings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name={bookings.length === 0 ? "calendar" : "filter"} size={28} color={colors.textMute} />
                <Text style={styles.muted}>
                  {bookings.length === 0 ? "No bookings yet." : `No ${filter} bookings.`}
                </Text>
                {bookings.length === 0 ? (
                  <Pressable style={styles.emptyCta} onPress={() => router.push("/(tabs)/browse")}>
                    <Feather name="search" size={13} color={colors.pink} />
                    <Text style={styles.emptyCtaText}>Browse artists</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.emptyCta} onPress={() => setFilter("all")}>
                    <Text style={styles.emptyCtaText}>Show all bookings</Text>
                  </Pressable>
                )}
              </View>
            }
            renderItem={({ item }) => {
              const otherParty = item.artist?.stageName ?? item.booker?.fullName ?? "GiggiFi";
              const canBookAgain = COMPLETED_STATUSES.has(item.status);
              return (
                <Pressable onPress={() => router.push({ pathname: "/booking/[id]", params: { id: item.id } })}>
                  <GlassCard style={styles.card}>
                    <View style={styles.row}>
                      <Text style={styles.eventName} numberOfLines={1}>{item.eventName}</Text>
                      <StatusBadge status={item.status} />
                    </View>
                    <Text style={styles.meta}>{otherParty} · {item.eventCity}</Text>
                    <View style={styles.dateRow}>
                      <Feather name="calendar" size={11} color={colors.textMute} />
                      <Text style={styles.dateText}>
                        {new Date(item.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                    {item.totalAmount ? (
                      <Text style={styles.amount}>₹{item.totalAmount.toLocaleString("en-IN")}</Text>
                    ) : null}
                    {canBookAgain ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          hapticSelect();
                          router.push({ pathname: "/booking/rebook", params: { bookingId: item.id } });
                        }}
                        style={styles.bookAgainButton}
                        hitSlop={6}
                      >
                        <Feather name="repeat" size={12} color={colors.pink} />
                        <Text style={styles.bookAgainText}>Book Again</Text>
                      </Pressable>
                    ) : null}
                  </GlassCard>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

// ─── Your Regulars ─────────────────────────────────────────────────────────
// Artists this client has genuinely booked 2+ times (completed events) in
// the last 6 months — entirely server-computed (GET /api/mobile/bookings/
// regulars), never a curated list. Skips rendering anything once both the
// fetch has resolved and there's truly nothing to show, rather than a
// permanent empty card — a client with no repeat bookings yet just sees
// the regular booking list below with no extra clutter above it.
function RegularsSection({ loading, regulars }: { loading: boolean; regulars: RegularArtistEntry[] }) {
  if (loading) {
    return (
      <View style={styles.regularsWrap}>
        <Text style={styles.regularsTitle}>Your Regulars</Text>
        <View style={styles.regularsRow}>
          {[0, 1].map((i) => (
            <Skeleton key={i} width={150} height={92} borderRadius={radii.lg} />
          ))}
        </View>
      </View>
    );
  }

  // Genuinely no repeat-booked artists yet (2+ completed bookings with the
  // same artist in the last 6 months) — a real, still-useful state, not a
  // broken-looking blank section. Points at Browse, same as the rest of the
  // app's discovery CTAs; deliberately NOT the "Get a Quote" RFP flow.
  if (regulars.length === 0) {
    return (
      <View style={styles.regularsWrap}>
        <Text style={styles.regularsTitle}>Your Regulars</Text>
        <Pressable
          style={styles.regularsEmptyCard}
          onPress={() => router.push({ pathname: "/(tabs)/browse", params: { vertical: "artist" } })}
        >
          <Feather name="compass" size={18} color={colors.pink} />
          <View style={styles.regularsEmptyText}>
            <Text style={styles.regularsEmptyTitle}>Book the same artist twice and they&apos;ll show up here</Text>
            <Text style={styles.regularsEmptySub}>Get inspired — browse artists</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textMute} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.regularsWrap}>
      <Text style={styles.regularsTitle}>Your Regulars</Text>
      <Text style={styles.regularsSub}>Artists you keep coming back to</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regularsRow}>
        {regulars.map((entry) => (
          <RegularArtistCard key={entry.artist.id} entry={entry} />
        ))}
      </ScrollView>
    </View>
  );
}

function RegularArtistCard({ entry }: { entry: RegularArtistEntry }) {
  const { artist, bookingCount, lastBookingId } = entry;
  const name = artist.stageName ?? "GiggiFi Artist";
  const initial = name.trim().charAt(0).toUpperCase();
  const [c1, c2] = duotoneFor(artist.id);

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/artist/[id]", params: { id: artist.id } })}
      style={styles.regularCard}
    >
      <View style={styles.regularCardTop}>
        {artist.profileImageUrl ? (
          <Image source={{ uri: artist.profileImageUrl }} style={styles.regularAvatar} contentFit="cover" />
        ) : (
          <LinearGradientFallback c1={c1} c2={c2} initial={initial} />
        )}
        <View style={styles.regularInfo}>
          <Text style={styles.regularName} numberOfLines={1}>{name}</Text>
          <Text style={styles.regularCount}>{bookingCount} bookings</Text>
        </View>
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          hapticSelect();
          router.push({ pathname: "/booking/rebook", params: { bookingId: lastBookingId } });
        }}
        style={styles.regularBookAgain}
        hitSlop={6}
      >
        <Feather name="repeat" size={11} color={colors.pink} />
        <Text style={styles.regularBookAgainText}>Book Again</Text>
      </Pressable>
    </Pressable>
  );
}

function LinearGradientFallback({ c1, initial }: { c1: string; c2: string; initial: string }) {
  return (
    <View style={[styles.regularAvatar, styles.regularAvatarFallback, { backgroundColor: c1 }]}>
      <Text style={styles.regularAvatarInitial}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  oemCardWrap: { paddingHorizontal: spacing.lg },
  filterRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink2,
  },
  filterTabActive: { borderColor: colors.pink, backgroundColor: "rgba(236,72,153,0.1)" },
  filterTabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textMute,
  },
  filterTabTextActive: { color: colors.text, fontFamily: fonts.bodySemiBold },
  errorScroll: { flexGrow: 1, alignItems: "center", paddingTop: spacing.xl },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
  },
  retryButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.pink,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  eventName: {
    flex: 1,
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMute,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMute,
  },
  amount: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMute,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  emptyState: { alignItems: "center", gap: spacing.md, paddingTop: spacing.xl },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
  },
  emptyCtaText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.pink,
  },
  bookAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
  },
  bookAgainText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    color: colors.pink,
  },
  regularsWrap: { marginBottom: spacing.lg },
  regularsTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.text,
    paddingHorizontal: spacing.lg,
  },
  regularsSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMute,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: 2,
  },
  regularsRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  regularsEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  regularsEmptyText: { flex: 1, gap: 2 },
  regularsEmptyTitle: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.text },
  regularsEmptySub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.pink },
  regularCard: {
    width: 168,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 12,
    gap: 10,
  },
  regularCardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  regularAvatar: { width: 40, height: 40, borderRadius: 20 },
  regularAvatarFallback: { alignItems: "center", justifyContent: "center" },
  regularAvatarInitial: { fontFamily: fonts.display, fontSize: 15, color: "#fff" },
  regularInfo: { flex: 1, gap: 1 },
  regularName: { fontFamily: fonts.displayMedium, fontSize: 13.5, color: colors.text },
  regularCount: { fontFamily: fonts.body, fontSize: 11, color: colors.textMute },
  regularBookAgain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
  },
  regularBookAgainText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.pink,
  },
});
