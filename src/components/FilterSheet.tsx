import { forwardRef, useMemo, useState, useEffect } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { colors, fonts, gradients, radii, spacing } from "@/theme";
import { LinearGradient } from "expo-linear-gradient";
import { DEFAULT_FILTERS, type FilterState } from "@/lib/sort-filter";

interface Props {
  value: FilterState;
  onApply: (value: FilterState) => void;
}

export const FilterSheet = forwardRef<BottomSheetModal, Props>(function FilterSheet({ value, onApply }, ref) {
  const snapPoints = useMemo(() => ["55%"], []);
  const [draft, setDraft] = useState<FilterState>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>Filters</Text>

        <Text style={styles.label}>PRICE RANGE (₹)</Text>
        <View style={styles.priceRow}>
          <TextInput
            value={draft.minPrice}
            onChangeText={(text) => setDraft((d) => ({ ...d, minPrice: text.replace(/\D/g, "") }))}
            placeholder="Min"
            placeholderTextColor={colors.textMute}
            keyboardType="number-pad"
            style={styles.priceInput}
          />
          <View style={styles.priceDash} />
          <TextInput
            value={draft.maxPrice}
            onChangeText={(text) => setDraft((d) => ({ ...d, maxPrice: text.replace(/\D/g, "") }))}
            placeholder="Max"
            placeholderTextColor={colors.textMute}
            keyboardType="number-pad"
            style={styles.priceInput}
          />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Travel-ready artists only</Text>
          <Switch
            value={draft.travelReady}
            onValueChange={(v) => setDraft((d) => ({ ...d, travelReady: v }))}
            trackColor={{ true: colors.purple, false: colors.line }}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Negotiable pricing only</Text>
          <Switch
            value={draft.negotiableOnly}
            onValueChange={(v) => setDraft((d) => ({ ...d, negotiableOnly: v }))}
            trackColor={{ true: colors.purple, false: colors.line }}
          />
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.resetButton}
            onPress={() => {
              setDraft(DEFAULT_FILTERS);
              onApply(DEFAULT_FILTERS);
            }}
          >
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
          <Pressable style={styles.applyButtonWrap} onPress={() => onApply(draft)}>
            <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.applyButton}>
              <Text style={styles.applyText}>Apply Filters</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.ink2, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  handle: { backgroundColor: colors.lineStrong },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.textMute,
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  priceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  priceInput: {
    flex: 1,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  priceDash: { width: 10, height: 1, backgroundColor: colors.lineStrong },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  toggleLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  resetButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  resetText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textDim,
  },
  applyButtonWrap: { flex: 2 },
  applyButton: {
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  applyText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: "#fff",
  },
});
