import { forwardRef, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, gradients, radii, spacing } from "@/theme";

interface Props {
  onAccept: () => void;
  onDecline: () => void;
  onClosed: () => void;
}

// Shown once, right after the push-permission primer resolves — marketing
// consent defaults OFF and is otherwise buried in settings, so this is the
// one real chance to reach most users. See src/lib/use-offers-optin.ts.
export const OffersOptInSheet = forwardRef<BottomSheetModal, Props>(function OffersOptInSheet({ onAccept, onDecline, onClosed }, ref) {
  const snapPoints = useMemo(() => ["42%"], []);

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
          <Feather name="tag" size={22} color={colors.pink} />
        </View>
        <Text style={styles.title}>Never miss a deal</Text>
        <Text style={styles.body}>
          Want to hear about new artists in your city, price drops on artists you've saved, and festive offers?
        </Text>

        <View style={styles.actions}>
          <Pressable style={styles.declineButton} onPress={onDecline}>
            <Text style={styles.declineText}>No thanks</Text>
          </Pressable>
          <Pressable style={styles.acceptButtonWrap} onPress={onAccept}>
            <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.acceptButton}>
              <Text style={styles.acceptText}>Yes, keep me posted</Text>
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
  declineButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  declineText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textDim,
  },
  acceptButtonWrap: { flex: 2 },
  acceptButton: {
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  acceptText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: "#fff",
  },
});
