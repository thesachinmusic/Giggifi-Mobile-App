import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { OemDeliveryCard } from "@/components/OemDeliveryCard";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchBookings, type Booking } from "@/lib/api";
import { CONFIRMED_STATUSES, reconcileEventReminders } from "@/lib/event-reminders";
import { hapticSelect } from "@/lib/haptics";
import { getOemGuidance, type OemGuidance } from "@/lib/oem-delivery";
import { hasSeenOemCard, markOemCardSeen } from "@/lib/oem-guidance-storage";
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
  // booking on its detail screen and coming back here.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
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
});
