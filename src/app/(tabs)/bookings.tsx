import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { fetchBookings, type Booking } from "@/lib/api";
import { colors, fonts, spacing, radii } from "@/theme";

const STATUS_LABEL: Record<string, string> = {
  ENQUIRY_SENT: "Enquiry sent",
  QUOTE_RECEIVED: "Quote received",
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_HELD: "Confirmed",
  EVENT_UPCOMING: "Upcoming",
  EVENT_COMPLETED: "Completed",
  CANCELLED_BY_ARTIST: "Cancelled by artist",
  CANCELLED_BY_BOOKER: "Cancelled",
  DISPUTED: "In dispute",
  PAYOUT_RELEASED: "Paid out",
};

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { bookings: results } = await fetchBookings();
      setBookings(results);
    } catch {
      setError("Couldn't load your bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.title}>Bookings</Text>

        {loading ? (
          <ActivityIndicator color={colors.pink} style={styles.loader} />
        ) : error ? (
          <Text style={styles.muted}>{error}</Text>
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.muted}>No bookings yet — go book an artist from Browse.</Text>}
            renderItem={({ item }) => {
              const otherParty = item.artist?.stageName ?? item.booker?.fullName ?? "GiggFi";
              return (
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
