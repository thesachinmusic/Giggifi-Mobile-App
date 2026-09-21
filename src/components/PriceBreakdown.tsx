import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { GlassCard } from "@/components/GlassCard";
import { GradientText } from "@/components/GradientText";
import { colors, fonts, spacing, textScale, visualColors, withAlpha } from "@/theme";

// One line of the itemised price. A negative amount is a discount; kind "tax"
// marks government tax so it reads as tax, not as Giggifi's markup.
export interface PriceLine {
  label: string;
  amount: number;
  kind?: "tax";
}

function money(n: number) {
  return `₹${Math.abs(n).toLocaleString("en-IN")}`;
}

// The reassurances shown next to the total. Only things that are true of the
// booking flow: payment is held until the event (escrow), artists go through
// KYC, and there is a dispute action plus the backup-artist guarantee.
const ASSURANCES = [
  "Secure payment — the artist is paid only after your event",
  "Verified & KYC-checked artists",
  "Dispute & no-show protection",
] as const;

// Leads with ONE final total, with the full itemised breakdown one tap away (or
// already open with `defaultExpanded`). Every rupee of the total is a line in
// the breakdown — nothing is folded into a vague "charges" figure.
export function PriceBreakdown({
  total,
  lines,
  defaultExpanded = false,
  totalLabel = "Total you pay",
}: {
  total: number;
  lines: PriceLine[];
  defaultExpanded?: boolean;
  totalLabel?: string;
}) {
  const [open, setOpen] = useState(defaultExpanded);

  return (
    <GlassCard style={styles.card}>
      <Text style={styles.totalLabel}>{totalLabel}</Text>
      <GradientText style={styles.total}>{money(total)}</GradientText>

      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.toggleText}>{open ? "Hide price breakdown" : "See price breakdown"}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.orange} />
      </Pressable>

      {open ? (
        <View style={styles.lines}>
          {lines.map((line) => (
            <View key={line.label} style={styles.line}>
              <View style={styles.lineLeft}>
                <Text style={styles.lineLabel}>{line.label}</Text>
                {line.kind === "tax" ? (
                  <View style={styles.taxChip}><Text style={styles.taxChipText}>TAX</Text></View>
                ) : null}
              </View>
              <Text style={[styles.lineValue, line.amount < 0 && styles.discountValue]}>
                {line.amount < 0 ? `− ${money(line.amount)}` : money(line.amount)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.line}>
            <Text style={styles.sumLabel}>Total</Text>
            <Text style={styles.sumValue}>{money(total)}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.assurances}>
        {ASSURANCES.map((text) => (
          <View key={text} style={styles.assurance}>
            <Feather name="check-circle" size={13} color={visualColors.mint} />
            <Text style={styles.assuranceText}>{text}</Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginVertical: spacing.sm },
  totalLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: colors.textMute, textTransform: "uppercase" },
  total: { fontFamily: fonts.displayBold, fontSize: textScale.hero, letterSpacing: -0.5, marginTop: 2 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: spacing.xs, paddingVertical: 4 },
  toggleText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.orange },
  pressed: { opacity: 0.7 },
  lines: { marginTop: spacing.xs, gap: 8 },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  lineLeft: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  lineLabel: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textDim, flexShrink: 1 },
  lineValue: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text },
  discountValue: { color: visualColors.mint },
  taxChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: withAlpha(visualColors.cyan, 0.16) },
  taxChipText: { fontFamily: fonts.mono, fontSize: 8.5, color: visualColors.cyan, letterSpacing: 0.6 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 2 },
  sumLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  sumValue: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.text },
  assurances: { marginTop: spacing.md, gap: 7, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  assurance: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  assuranceText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textDim },
});
