import { forwardRef, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, gradients, radii, spacing } from "@/theme";

interface Props {
  onEnable: () => void;
  onNotNow: () => void;
  onClosed: () => void;
}

// Primes the user for the OS permission prompt AFTER they've sent their
// first enquiry — not the instant they log in, before they have any reason
// to say yes. iOS only ever shows its own dialog once, so this sheet is the
// only chance to make the "why" land before that one shot is spent.
export const PushPrimerSheet = forwardRef<BottomSheetModal, Props>(function PushPrimerSheet({ onEnable, onNotNow, onClosed }, ref) {
  const snapPoints = useMemo(() => ["40%"], []);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onDismiss={onClosed}
      backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.iconWrap}>
          <Feather name="bell" size={22} color={colors.pink} />
        </View>
        <Text style={styles.title}>Never miss a reply</Text>
        <Text style={styles.body}>Get notified the moment an artist replies to your enquiry.</Text>

        <View style={styles.actions}>
          <Pressable style={styles.dismissButton} onPress={onNotNow}>
            <Text style={styles.dismissText}>Not now</Text>
          </Pressable>
          <Pressable style={styles.enableButtonWrap} onPress={onEnable}>
            <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.enableButton}>
              <Text style={styles.enableText}>Turn on notifications</Text>
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
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, alignItems: "center" },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(236,72,153,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  dismissButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  dismissText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textDim,
  },
  enableButtonWrap: { flex: 2 },
  enableButton: {
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  enableText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: "#fff",
  },
});
