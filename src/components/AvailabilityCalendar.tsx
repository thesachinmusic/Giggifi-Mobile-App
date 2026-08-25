import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { GlassCard } from "@/components/GlassCard";
import { colors, fonts, spacing } from "@/theme";
import { API_BASE_URL } from "@/lib/api";

type DateAvailability = "AVAILABLE" | "PENDING" | "UNAVAILABLE";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MAX_MONTHS_AHEAD = 3;

function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const DOT: Record<DateAvailability, string> = {
  AVAILABLE: colors.ok,
  PENDING: colors.warn,
  UNAVAILABLE: colors.err,
};

// Read-only — mirrors the website's calendar on the same public route
// (GET /api/artist/[id]/availability), used by both platforms. The actual
// event date is still picked inside the booking form; this is just a
// glance at when the artist already has something on.
export function AvailabilityCalendar({ artistId }: { artistId: string }) {
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [dates, setDates] = useState<Record<string, DateAvailability>>({});
  const [globallyAvailable, setGloballyAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  const viewYear = today.getFullYear();
  const viewMonth = today.getMonth() + monthOffset;
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const from = new Date(viewYear, viewMonth, 1);
    const to = new Date(viewYear, viewMonth + 1, 0);
    fetch(`${API_BASE_URL}/api/artist/${artistId}/availability?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setDates(d.dates ?? {});
        setGloballyAvailable(d.globallyAvailable ?? true);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId, monthOffset]);

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Availability</Text>
        <View style={styles.nav}>
          <Pressable
            disabled={monthOffset === 0}
            onPress={() => setMonthOffset((o) => Math.max(0, o - 1))}
            style={[styles.navButton, monthOffset === 0 && styles.navButtonDisabled]}
          >
            <Text style={styles.navButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth % 12]} {viewYear + Math.floor(viewMonth / 12)}</Text>
          <Pressable
            disabled={monthOffset >= MAX_MONTHS_AHEAD}
            onPress={() => setMonthOffset((o) => Math.min(MAX_MONTHS_AHEAD, o + 1))}
            style={[styles.navButton, monthOffset >= MAX_MONTHS_AHEAD && styles.navButtonDisabled]}
          >
            <Text style={styles.navButtonText}>›</Text>
          </Pressable>
        </View>
      </View>

      {!globallyAvailable ? (
        <Text style={styles.notAcceptingText}>This artist isn&apos;t currently accepting new bookings.</Text>
      ) : loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.textMute} />
        </View>
      ) : (
        <>
          <View style={styles.weekRow}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <Text key={i} style={styles.weekLabel}>{d}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={i} style={styles.cell} />;
              const key = toDateKey(viewYear, viewMonth, day);
              const isPast = new Date(viewYear, viewMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const status = dates[key];
              return (
                <View
                  key={i}
                  style={[
                    styles.cell,
                    !isPast && status ? { backgroundColor: `${DOT[status]}22`, borderColor: `${DOT[status]}66`, borderWidth: 1 } : null,
                  ]}
                >
                  <Text style={[styles.cellText, isPast && styles.cellTextPast]}>{day}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            {([["AVAILABLE", "Available"], ["PENDING", "Pending"], ["UNAVAILABLE", "Unavailable"]] as [DateAvailability, string][]).map(([s, label]) => (
              <View key={s} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: DOT[s] }]} />
                <Text style={styles.legendLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </GlassCard>
  );
}

const CELL_SIZE = "14.28%";

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginTop: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  nav: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  navButton: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink2, alignItems: "center", justifyContent: "center" },
  navButtonDisabled: { opacity: 0.3 },
  navButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textDim },
  monthLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textDim, width: 96, textAlign: "center" },
  loadingBox: { height: 160, alignItems: "center", justifyContent: "center" },
  notAcceptingText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute },
  weekRow: { flexDirection: "row" },
  weekLabel: { width: CELL_SIZE, textAlign: "center", fontFamily: fonts.mono, fontSize: 9, color: colors.textMute, textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: CELL_SIZE, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  cellText: { fontFamily: fonts.body, fontSize: 12, color: colors.text },
  cellTextPast: { color: colors.textMute, opacity: 0.4 },
  legend: { flexDirection: "row", gap: spacing.md, paddingTop: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMute },
});
