import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { OemDeliveryCard } from "@/components/OemDeliveryCard";
import { fetchBookings, type Booking } from "@/lib/api";
import { STATUS_LABEL } from "@/lib/booking-status";
import { CONFIRMED_STATUSES, reconcileEventReminders } from "@/lib/event-reminders";
import { getOemGuidance, type OemGuidance } from "@/lib/oem-delivery";
import { hasSeenOemCard, markOemCardSeen } from "@/lib/oem-guidance-storage";
import { colors, fonts, spacing, radii } from "@/theme";

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [oemGuidance, setOemGuidance] = useState<OemGuidance | null>(null);

  // setLoading(false) only ever fires here, never reset to true afterwards —
  // so the first call (on initial mount, since useFocusEffect below fires
  // then too) shows the full-screen spinner, and every later call just
  // updates the list quietly in place instead of re-blocking the screen.
  const load = useCallback(async () => {
    setError("");
    try {
      const { bookings: results } = await fetchBookings();
      setBookings(results);
      reconcileEventReminders(results).catch(() => {});
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
    markOemCardSeen().catch(() => {});
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

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.title}>Bookings</Text>

        {oemGuidance ? (
          <View style={styles.oemCardWrap}>
            <OemDeliveryCard guidance={oemGuidance} onDismiss={dismissOemCard} />
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.pink} style={styles.loader} />
        ) : error && bookings.length === 0 ? (
          // Only block on error before any data has loaded — a later
          // background refresh failure (focus, pull-to-refresh) shouldn't
          // blank out an already-populated list.
          <Text style={styles.muted}>{error}</Text>
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={<Text style={styles.muted}>No bookings yet — go book an artist from Browse.</Text>}
            renderItem={({ item }) => {
              const otherParty = item.artist?.stageName ?? item.booker?.fullName ?? "GiggiFi";
              return (
                <Pressable onPress={() => router.push({ pathname: "/booking/[id]", params: { id: item.id } })}>
                  <GlassCard style={styles.card}>
                    <View style={styles.row}>
                      <Text style={styles.eventName} numberOfLines={1}>{item.eventName}</Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{STATUS_LABEL[item.status] ?? item.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.meta}>{otherParty} · {item.eventCity}</Text>
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
  loader: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  eventName: {
    flex: 1,
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(168,85,247,0.15)",
  },
  badgeText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
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
});
