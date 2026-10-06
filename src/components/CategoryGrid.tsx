import { FlatList, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { accentForCategory, colors, fonts, mock, radii, shadows, spacing, withAlpha } from "@/theme";
import { CATEGORIES } from "@/lib/categories";
import { VENDOR_CATEGORIES } from "@/lib/vendor-categories";

interface Props {
  vertical?: "artist" | "vendor";
  limit?: number;
}

interface CategoryOption {
  label: string;
  emoji: string;
}

// Bundled category photos (AI-generated stand-ins for the common categories,
// ~15-40 KB each). Only categories listed here get a photo tile; every other
// category keeps the original emoji tile. Keyed by the real category label.
const CATEGORY_PHOTOS: Record<string, ImageSourcePropType> = {
  Singer: require("@/assets/images/categories/singer.jpg"),
  DJ: require("@/assets/images/categories/dj.jpg"),
  "Live Band": require("@/assets/images/categories/live-band.jpg"),
  Instrumentalist: require("@/assets/images/categories/instrumentalist.jpg"),
  Dancer: require("@/assets/images/categories/dancer.jpg"),
  Anchor: require("@/assets/images/categories/anchor.jpg"),
  Magician: require("@/assets/images/categories/magician.jpg"),
  "Photography & Videography": require("@/assets/images/categories/photography.jpg"),
  "Decor & Design": require("@/assets/images/categories/decor.jpg"),
  "Catering & Food": require("@/assets/images/categories/catering.jpg"),
  "Beauty & Styling": require("@/assets/images/categories/beauty.jpg"),
  "Sound & Lights": require("@/assets/images/categories/sound.jpg"),
};

// Zomato-style horizontal category rail — icon chip + label, swipe sideways
// instead of wrapping into a static grid. Tapping jumps into Browse pre-filtered.
export function CategoryGrid({ vertical = "artist", limit }: Props) {
  const source: readonly CategoryOption[] = vertical === "artist" ? CATEGORIES : VENDOR_CATEGORIES;
  const categories = limit ? source.slice(0, limit) : source;

  return (
    <FlatList
      data={categories}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.label}
      contentContainerStyle={styles.row}
      renderItem={({ item: category }) => {
        // Accent only for artist categories that map cleanly onto one; the
        // rest (and all vendor categories) keep the neutral tile.
        const accent = vertical === "artist" ? accentForCategory(category.label) : undefined;
        const photo = CATEGORY_PHOTOS[category.label];
        const open = () => router.push({ pathname: "/(tabs)/browse", params: { category: category.label, vertical } });
        if (photo) {
          return (
            <Pressable style={({ pressed }) => [styles.photoTile, pressed && styles.itemPressed]} onPress={open}>
              <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient
                colors={["rgba(10,8,18,0)", "rgba(10,8,18,0.9)"]}
                locations={[0.45, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <Text style={styles.photoLabel} numberOfLines={3}>{category.label}</Text>
            </Pressable>
          );
        }
        return (
          <Pressable
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={open}
          >
            <View
              style={[
                styles.iconWrap,
                accent ? { borderColor: withAlpha(accent, 0.5), backgroundColor: withAlpha(accent, 0.12) } : null,
              ]}
            >
              <Text style={styles.emoji}>{category.emoji}</Text>
            </View>
            <Text style={styles.label} numberOfLines={1}>{category.label}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.md,
    gap: 8,
    alignItems: "flex-start",
  },
  photoTile: {
    width: 86,
    height: 108,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: mock.cardBorderWarm,
    backgroundColor: colors.surface,
    justifyContent: "flex-end",
  },
  photoLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10.5,
    lineHeight: 12,
    color: "#fff",
    textAlign: "center",
    paddingHorizontal: 4,
    paddingBottom: 9,
  },
  item: {
    width: 72,
    alignItems: "center",
    gap: 6,
  },
  itemPressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  emoji: {
    fontSize: 26,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: colors.textDim,
    textAlign: "center",
  },
});
