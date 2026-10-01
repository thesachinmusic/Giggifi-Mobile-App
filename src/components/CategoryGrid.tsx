import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { accentForCategory, colors, fonts, radii, shadows, spacing, withAlpha } from "@/theme";
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
        return (
          <Pressable
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => router.push({ pathname: "/(tabs)/browse", params: { category: category.label, vertical } })}
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
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
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
