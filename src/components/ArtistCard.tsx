import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "@/theme";
import { duotoneFor } from "@/lib/palette";
import { RatingBadge } from "@/components/RatingBadge";
import { useSavedArtists } from "@/lib/saved-artists-context";
import type { ArtistSummary, VendorSummary } from "@/lib/api";

interface ListingCardProps {
  artist?: ArtistSummary;
  vendor?: VendorSummary;
  onPress: () => void;
  width?: number;
}

// Renders either an artist or a vendor summary through one visual language —
// pass exactly one of `artist` / `vendor`.
export function ArtistCard({ artist, vendor, onPress, width }: ListingCardProps) {
  const { isSaved, toggle } = useSavedArtists();
  const id = artist?.id ?? vendor!.id;
  const name = artist ? (artist.stageName ?? "GiggiFi Artist") : (vendor!.businessName ?? "GiggiFi Vendor");
  const tag = artist?.performerType ?? vendor?.category ?? null;
  const city = artist?.city ?? vendor?.city ?? null;
  const price = artist?.ratePerEvent ?? vendor?.startingPrice ?? null;
  const image = artist?.profileImageUrl ?? vendor?.profileImageUrl ?? null;
  const rating = artist?.avgRating ?? vendor?.avgRating;
  const isFeatured = artist?.isFeatured ?? false;
  const initial = name.trim().charAt(0).toUpperCase();
  const [c1, c2] = duotoneFor(id);
  const saved = artist ? isSaved(artist.id) : false;

  return (
    <Pressable onPress={onPress} style={[styles.card, width ? { width } : styles.cardFlex]}>
      <View style={styles.imageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
            <Text style={styles.initial}>{initial}</Text>
          </LinearGradient>
        )}
        {tag ? (
          <View style={styles.tag}>
            <Text style={styles.tagText} numberOfLines={1}>{tag.toUpperCase()}</Text>
          </View>
        ) : null}
        {isFeatured ? (
          <View style={styles.featuredTag}>
            <Feather name="zap" size={9} color="#000" />
            <Text style={styles.featuredText}>FEATURED</Text>
          </View>
        ) : null}
        {artist ? (
          <Pressable
            hitSlop={8}
            style={styles.saveButton}
            onPress={(e) => { e.stopPropagation(); toggle(artist.id); }}
          >
            <Feather name="heart" size={14} color={saved ? colors.pink : "#fff"} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <RatingBadge rating={rating} />
        </View>
        {city ? (
          <View style={styles.row}>
            <Feather name="map-pin" size={11} color={colors.textMute} />
            <Text style={styles.loc} numberOfLines={1}>{city}</Text>
          </View>
        ) : null}
        {price ? (
          <Text style={styles.price}>₹{price.toLocaleString("en-IN")} <Text style={styles.priceUnit}>/ event</Text></Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardFlex: {
    flex: 1,
  },
  imageWrap: {
    aspectRatio: 3 / 4,
    position: "relative",
  },
  initial: {
    flex: 1,
    textAlign: "center",
    textAlignVertical: "center",
    fontFamily: fonts.display,
    fontSize: 72,
    color: "rgba(255,255,255,0.18)",
  },
  tag: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  tagText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text,
    letterSpacing: 0.5,
  },
  featuredTag: {
    position: "absolute",
    top: 40,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.orange,
  },
  featuredText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: "#000",
    letterSpacing: 0.5,
  },
  saveButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: spacing.sm,
    paddingTop: 12,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  name: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  loc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMute,
  },
  price: {
    marginTop: 4,
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
  },
  priceUnit: {
    color: colors.textMute,
  },
});
