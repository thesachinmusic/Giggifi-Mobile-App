import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { QUICK_MOMENTS_MIN_LEAD_HOURS } from "@/lib/quick-moments";
import { fonts, mock, mockGradients, spacing } from "@/theme";

interface Tile {
  key: string;
  // The mock shows no icon on My Event Hub and a small one on Post Your
  // Requirement, so size is per tile (null = no icon).
  icon: keyof typeof Feather.glyphMap;
  iconSize: number | null;
  iconColor: string;
  title: string;
  sub: string;
  href: Href;
  primary?: boolean;
}

// Home's four quick-action tiles. Every destination is the one the old strip
// or card already opened: Quick Moments, the Get a Quote (RFP) flow — only
// its label is "Post Your Requirement" now —, the Reels tab and My Event Hub.
// Quick Booking's subtitle comes from the same lead-time constant the
// booking form enforces, never a hardcoded number.
const TILES: Tile[] = [
  {
    key: "quick",
    icon: "zap",
    iconSize: 22,
    iconColor: "#fff",
    title: "Quick Booking",
    sub: `${QUICK_MOMENTS_MIN_LEAD_HOURS} hrs before`,
    href: "/quick-moments",
    primary: true,
  },
  { key: "requirement", icon: "file-text", iconSize: 14, iconColor: mock.amber, title: "Post Your Requirement", sub: "Tell us what you need", href: "/quote-requests" },
  { key: "reels", icon: "play-circle", iconSize: 22, iconColor: mock.roseSoft, title: "Reels", sub: "Discover and get inspired", href: "/(tabs)/reels" },
  { key: "hub", icon: "calendar", iconSize: null, iconColor: mock.roseSoft, title: "My Event Hub", sub: "Countdown, budget & checklist", href: "/my-event" },
];

export function HomeQuickTiles() {
  return (
    <View style={styles.row}>
      {TILES.map((tile) => (
        <Pressable
          key={tile.key}
          onPress={() => router.push(tile.href)}
          style={({ pressed }) => [styles.tile, tile.primary ? styles.tilePrimary : styles.tilePlain, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${tile.title}. ${tile.sub}`}
        >
          {tile.primary ? (
            <LinearGradient colors={mockGradients.tile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          ) : null}
          {tile.iconSize ? <Feather name={tile.icon} size={tile.iconSize} color={tile.iconColor} /> : null}
          <Text style={styles.title} numberOfLines={3}>{tile.title}</Text>
          <Text style={[styles.sub, tile.primary && styles.subPrimary]} numberOfLines={3}>{tile.sub}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  tile: {
    flex: 1,
    minWidth: 0,
    height: 96,
    borderRadius: 18,
    paddingHorizontal: 4,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    overflow: "hidden",
    borderWidth: 1,
  },
  tilePrimary: { borderColor: "rgba(255,255,255,0.3)" },
  tilePlain: { backgroundColor: mock.cardFill, borderColor: "rgba(255,190,120,0.2)" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 11.5, lineHeight: 13, color: "#fff", textAlign: "center" },
  sub: { fontFamily: fonts.body, fontSize: 9.5, lineHeight: 11, color: mock.textSoft, textAlign: "center" },
  subPrimary: { color: "#FFE3D0" },
});
