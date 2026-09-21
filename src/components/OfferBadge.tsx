import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ArtistOfferBadge } from "@/lib/api";
import { offerBadgeLabel } from "@/lib/offer-badge";
import { fonts, radii, visualColors } from "@/theme";

// Small "10% OFF"-style pill for an artist's live offer. Sits alongside the
// Featured badge — the two are independent and can both show.
export function OfferBadge({ offer, style }: { offer: ArtistOfferBadge; style?: ViewStyle }) {
  return (
    <View style={[styles.badge, style]} accessibilityLabel={`Offer: ${offerBadgeLabel(offer)}`}>
      <Feather name="tag" size={9} color={visualColors.ink} />
      <Text style={styles.text} numberOfLines={1}>{offerBadgeLabel(offer)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: visualColors.mint,
  },
  text: { fontFamily: fonts.mono, fontSize: 9, color: visualColors.ink, letterSpacing: 0.5 },
});
