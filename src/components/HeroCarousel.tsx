import { useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { fonts, gradients, radii, spacing } from "@/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const CARD_HEIGHT = 168;

interface Slide {
  id: string;
  tag: string;
  title: string;
  sub: string;
  cta: string;
  href: Href;
}

// Home's hero carousel — 3 slides, identical size/background gradient
// (only tag/headline/subtext/CTA differ). Replaces the old standalone
// "Open Planner" and "GiggiFi 20-20 / Quick Performance" promo cards; both
// destinations below are unchanged, just relocated into one carousel.
// Slide 3 ("Secure Payment") now has a real destination — see
// app/how-it-works.tsx.
const SLIDES: Slide[] = [
  {
    id: "planner",
    tag: "Event Planner",
    title: "Artists, decor, sound & more — planned",
    sub: "Tell us your event, we suggest what you need",
    cta: "Open planner",
    href: "/plan-my-event",
  },
  {
    id: "quick",
    tag: "⚡ Quick Performance",
    title: "Same-day booking, big surprises",
    sub: "Budget friendly, quick and short performance",
    cta: "Book now",
    href: "/quick-moments",
  },
  {
    id: "secure",
    tag: "Secure Payment",
    title: "You pay only after the event is done",
    sub: "Money held safe until the booking is complete",
    cta: "How it works",
    href: "/how-it-works",
  },
];

export function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveIndex(viewableItems[0].index);
  }).current;

  return (
    <View>
      <FlatList
        data={SLIDES}
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
          <Pressable onPress={() => router.push(item.href)} style={{ width: CARD_WIDTH }}>
            <LinearGradient
              colors={gradients.hero}
              locations={gradients.heroLocations}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.glowOuter} />
              <View style={styles.glowInner} />
              <View style={styles.tagPill}>
                <Text style={styles.tagText}>{item.tag.toUpperCase()}</Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.sub} numberOfLines={1}>{item.sub}</Text>
              <View style={styles.ctaPill}>
                <Text style={styles.ctaText}>{item.cta}</Text>
                <Feather name="arrow-right" size={14} color="#3d1a52" />
              </View>
            </LinearGradient>
          </Pressable>
        )}
      />
      <View style={styles.dots}>
        {SLIDES.map((slide, index) => (
          <View key={slide.id} style={[styles.dot, index === activeIndex ? styles.dotActive : null]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: radii.xl,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.xs,
    overflow: "hidden",
  },
  glowOuter: {
    position: "absolute",
    top: -60,
    right: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,179,64,0.16)",
  },
  glowInner: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,179,64,0.22)",
  },
  tagPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  tagText: { fontFamily: fonts.mono, fontSize: 10, color: "#fff", letterSpacing: 1 },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, color: "#fff" },
  sub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: "rgba(255,255,255,0.88)" },
  ctaPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    marginTop: spacing.xs,
    backgroundColor: "#fff",
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  ctaText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: "#3d1a52" },
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
