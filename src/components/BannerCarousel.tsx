import { useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { fonts, radii, spacing } from "@/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

interface Banner {
  id: string;
  doodle: string;
  eyebrow: string;
  title: string;
  sub: string;
  colors: readonly [string, string, ...string[]];
  href: string;
}

const BANNERS: Banner[] = [
  {
    id: "verified",
    doodle: "🛡️",
    eyebrow: "TRUST & SAFETY",
    title: "Verified artists,\nsecure payments",
    sub: "Every rupee is held safely until your event is confirmed done.",
    colors: ["#a855f7", "#e0307a"],
    href: "/(tabs)/browse",
  },
  {
    id: "plan",
    doodle: "🎉",
    eyebrow: "PLANNING AN EVENT?",
    title: "Book any artist\n& vendor in minutes",
    sub: "Wedding, birthday, corporate — one app, every booking.",
    colors: ["#ec4899", "#ff8a3d"],
    href: "/ask-giggfi",
  },
  {
    id: "categories",
    doodle: "🎤",
    eyebrow: "9 CATEGORIES",
    title: "Singers, DJs,\nbands & more",
    sub: "Browse verified performers across every category, every city.",
    colors: ["#e0307a", "#ff8a3d"],
    href: "/(tabs)/browse",
  },
  {
    id: "vendors",
    doodle: "🎨",
    eyebrow: "12 VENDOR CATEGORIES",
    title: "Decor, catering,\nphotography & more",
    sub: "Everything your event needs, beyond the stage.",
    colors: ["#ff8a3d", "#a855f7"],
    href: "/(tabs)/browse",
  },
  {
    id: "quick",
    doodle: "⚡",
    eyebrow: "BOOK IN MINUTES",
    title: "Send an enquiry,\nget quotes fast",
    sub: "Tell an artist what you need — they respond directly.",
    colors: ["#a855f7", "#ec4899"],
    href: "/(tabs)/browse",
  },
];

export function BannerCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveIndex(viewableItems[0].index);
  }).current;

  return (
    <View>
      <FlatList
        data={BANNERS}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + spacing.sm}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(item.href as never)} style={{ width: CARD_WIDTH }}>
            <LinearGradient colors={item.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
              <Text style={styles.doodle}>{item.doodle}</Text>
              <Text style={styles.eyebrow}>{item.eyebrow}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.sub}>{item.sub}</Text>
            </LinearGradient>
          </Pressable>
        )}
      />
      <View style={styles.dots}>
        {BANNERS.map((banner, index) => (
          <View key={banner.id} style={[styles.dot, index === activeIndex ? styles.dotActive : null]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 150,
    borderRadius: radii.xl,
    padding: spacing.lg,
    justifyContent: "center",
    overflow: "hidden",
  },
  doodle: {
    position: "absolute",
    top: -6,
    right: 4,
    fontSize: 72,
    opacity: 0.18,
    transform: [{ rotate: "-12deg" }],
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 24,
    color: "#fff",
    marginBottom: 6,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: "rgba(255,255,255,0.85)",
    maxWidth: "85%",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  dotActive: {
    backgroundColor: "#fff",
    width: 16,
  },
});
