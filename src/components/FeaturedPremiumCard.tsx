import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, mock, mockGradients } from "@/theme";
import { duotoneFor } from "@/lib/palette";
import { useSavedArtists } from "@/lib/saved-artists-context";
import type { ArtistSummary } from "@/lib/api";

export const FEATURED_PREMIUM_CARD_WIDTH = 216;
const CARD_HEIGHT = 176;

interface Props {
  artist: ArtistSummary;
  // Same two destinations the previous Featured card had: tapping the card
  // opens the video feed when the artist has a video (otherwise the profile),
  // and the profile stays one tap away via "Book Now".
  onOpenVideo: () => void;
  onViewProfile: () => void;
}

// Photo card for Home's "Featured Artists" container. The Premium pill and
// purple ring appear only when the API marks the artist `isFeatured` — i.e. a
// real, paid FeaturedCampaign. Any artist that reaches this rail without that
// flag (a future non-paid fill) gets a plain card.
export function FeaturedPremiumCard({ artist, onOpenVideo, onViewProfile }: Props) {
  const { isSaved, toggle } = useSavedArtists();
  const saved = isSaved(artist.id);
  const name = artist.stageName ?? "GiggiFi Artist";
  const hasVideo = Boolean(artist.introVideoUrl ?? artist.showreelUrl);
  const premium = artist.isFeatured === true;
  const [c1, c2] = duotoneFor(artist.id);
  const rated = artist.avgRating != null && artist.avgRating > 0;

  return (
    <Pressable
      onPress={hasVideo ? onOpenVideo : onViewProfile}
      style={({ pressed }) => [styles.card, premium && styles.cardPremium, pressed && styles.pressed]}
    >
      {artist.profileImageUrl ? (
        <Image source={{ uri: artist.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
          <Text style={styles.initial}>{name.trim().charAt(0).toUpperCase()}</Text>
        </LinearGradient>
      )}
      <LinearGradient
        colors={["rgba(10,8,18,0.05)", "rgba(10,8,18,0.95)"]}
        locations={[0.3, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {premium ? (
        <View style={styles.premiumPill} pointerEvents="none">
          <MaterialCommunityIcons name="crown-outline" size={12} color={mock.amber} />
          <Text style={styles.premiumText}>Premium</Text>
        </View>
      ) : null}

      <Pressable
        hitSlop={10}
        style={styles.heart}
        onPress={(e) => { e.stopPropagation(); toggle(artist.id); }}
        accessibilityRole="button"
        accessibilityLabel={saved ? "Remove from saved" : "Save artist"}
      >
        <Feather name="heart" size={15} color={saved ? colors.pink : "#fff"} />
      </Pressable>

      <View style={styles.info} pointerEvents="box-none">
        <View style={styles.infoText}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {rated ? (
            <View style={styles.ratingRow}>
              <MaterialCommunityIcons name="star" size={12} color={mock.amber} />
              <Text style={styles.ratingText}>
                {artist.avgRating!.toFixed(1)}
                {artist.reviewCount ? ` (${artist.reviewCount})` : ""}
              </Text>
            </View>
          ) : null}
          {artist.city ? <Text style={styles.city} numberOfLines={1}>{artist.city}</Text> : null}
        </View>
        <Pressable onPress={onViewProfile} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Book ${name}`}>
          <LinearGradient colors={mockGradients.ctaRose} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookNow}>
            <Text style={styles.bookNowText}>Book Now</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: FEATURED_PREMIUM_CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: mock.cardBorderWarm,
  },
  // Paid placements keep the purple ring the app already used for them.
  cardPremium: { borderColor: colors.purple, borderWidth: 2 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  initial: { fontFamily: fonts.displayBold, fontSize: 56, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 28 },
  premiumPill: {
    position: "absolute",
    left: 10,
    top: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: 9,
    borderRadius: 11,
    backgroundColor: "rgba(20,14,10,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,178,74,0.5)",
  },
  premiumText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: "#FFD08A" },
  heart: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(10,8,18,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  infoText: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.displayBold, fontSize: 14, color: "#fff" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingText: { fontFamily: fonts.body, fontSize: 11.5, color: "#E8E0F5" },
  city: { fontFamily: fonts.body, fontSize: 11, color: mock.textSoft, marginTop: 1 },
  bookNow: { height: 30, paddingHorizontal: 11, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  bookNowText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: "#fff" },
});
