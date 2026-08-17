import { forwardRef, useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "@/theme";
import { SORT_OPTIONS, type SortOption } from "@/lib/sort-filter";

interface Props {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export const SortSheet = forwardRef<BottomSheetModal, Props>(function SortSheet({ value, onChange }, ref) {
  const snapPoints = useMemo(() => ["45%"], []);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>Sort by</Text>
        {SORT_OPTIONS.map((option) => {
          const active = option.key === value;
          return (
            <Pressable key={option.key} style={styles.row} onPress={() => onChange(option.key)}>
              <Text style={[styles.label, active ? styles.labelActive : null]}>{option.label}</Text>
              {active ? <Feather name="check" size={18} color={colors.pink} /> : null}
            </Pressable>
          );
        })}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.ink2, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  handle: { backgroundColor: colors.lineStrong },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textDim,
  },
  labelActive: {
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },
});
