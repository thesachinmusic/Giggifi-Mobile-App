import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "@/theme";
import { duotoneFor } from "@/lib/palette";
import type { ArtistSummary } from "@/lib/api";

export function ArtistCard({ artist, onPress, width }: { artist: ArtistSummary; onPress: () => void; width?: number }) {
  const name = artist.stageName ?? "GiggFi Artist";
  const initial = name.trim().charAt(0).toUpperCase();
  const [c1, c2] = duotoneFor(artist.id);

  return (
    <Pressable onPress={onPress} style={[styles.card, width ? { width } : styles.cardFlex]}>
      <View style={styles.imageWrap}>
        {artist.profileImageUrl ? (
          <Image source={{ uri: artist.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
            <Text style={styles.initial}>{initial}</Text>
          </LinearGradient>
        )}
        {artist.performerType ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{artist.performerType.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {artist.city ? (
          <View style={styles.row}>
            <Feather name="map-pin" size={11} color={colors.textMute} />
            <Text style={styles.loc} numberOfLines={1}>{artist.city}</Text>
          </View>
        ) : null}
        {artist.ratePerEvent ? (
          <Text style={styles.price}>₹{artist.ratePerEvent.toLocaleString("en-IN")} <Text style={styles.priceUnit}>/ event</Text></Text>
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
  body: {
    padding: spacing.sm,
    paddingTop: 12,
    gap: 4,
  },
  name: {
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
