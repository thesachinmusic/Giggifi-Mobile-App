import { useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View, type ImageSourcePropType, type ViewToken } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { fonts, gradients, mock, spacing } from "@/theme";

const SIDE = spacing.md;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - SIDE * 2;
const CARD_HEIGHT = 152;
const CARD_GAP = 8;

interface Slide {
  id: string;
  tag: string;
  title: string;
  titleSize: number;
  sub: string;
  cta: string;
  href: Href;
  // Slides without a photo (Secure Payment) keep the plain brand gradient.
  image?: ImageSourcePropType;
}

// Home's top carousel (artists set) — the old mid-page Event Planner, Quick
// Performance and For Businesses banners now live here as slides, each with
// its original copy and destination; only the look follows the new mock.
// "Next Event" is the default slide and opens Browse on the artists tab.
const ARTIST_SLIDES: Slide[] = [
  {
    id: "next",
    tag: "Book artists for your",
    title: "Next Event",
    titleSize: 30,
    sub: "Live Music · DJs · Performers · & More",
    cta: "Explore Artists",
    href: { pathname: "/(tabs)/browse", params: { vertical: "artist" } },
    image: require("@/assets/images/home/hero-next.jpg"),
  },
  {
    id: "quick",
    tag: "⚡ Quick Performance",
    title: "Same-day booking, big surprises",
    titleSize: 20,
    sub: "Budget friendly, quick and short performance",
    cta: "Book now",
    href: "/quick-moments",
    image: require("@/assets/images/home/hero-quick.jpg"),
  },
  {
    id: "planner",
    tag: "Event Planner",
    title: "Artists, decor, sound & more — planned",
    titleSize: 20,
    sub: "Tell us your event, we suggest what you need",
    cta: "Open planner",
    href: "/plan-my-event",
    image: require("@/assets/images/home/hero-planner.jpg"),
  },
  {
    id: "business",
    tag: "For Businesses",
    title: "Curated for Restaurants & Event Companies",
    titleSize: 20,
    sub: "Recurring bookings, business deals & invoicing.",
    cta: "See business deals",
    href: "/(tabs)/business",
    image: require("@/assets/images/home/hero-business.jpg"),
  },
  {
    id: "secure",
    tag: "Secure Payment",
    title: "You pay only after the event is done",
    titleSize: 20,
    sub: "Money held safe until the booking is complete",
    cta: "How it works",
    href: "/how-it-works",
  },
];

// Vendors set: no Quick Performance (Quick Moments is artists-only), and no
// Event Planner yet — /plan-my-event only matches artists, so a vendor slide
// pointing there would promise something it doesn't do. For Businesses and
// Secure Payment keep the same copy and destinations as the artists set.
const VENDOR_SLIDES: Slide[] = [
  {
    id: "next",
    tag: "Book vendors for your",
    title: "Next Event",
    titleSize: 30,
    sub: "Photo · Decor · Catering · & More",
    cta: "Explore Vendors",
    href: { pathname: "/(tabs)/browse", params: { vertical: "vendor" } },
    image: require("@/assets/images/home/hero-vendor-next.jpg"),
  },
  ARTIST_SLIDES.find((slide) => slide.id === "business")!,
  ARTIST_SLIDES.find((slide) => slide.id === "secure")!,
];

export function HeroCarousel({ vertical = "artist" }: { vertical?: "artist" | "vendor" }) {
  // Keyed so switching the Artists/Vendors toggle starts the new set on slide 1.
  return <CarouselList key={vertical} slides={vertical === "vendor" ? VENDOR_SLIDES : ARTIST_SLIDES} />;
}

function CarouselList({ slides }: { slides: Slide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveIndex(viewableItems[0].index);
  }).current;

  return (
    <View>
      <FlatList
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SIDE, gap: CARD_GAP }}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(item.href)} style={styles.card}>
            <LinearGradient
              colors={gradients.hero}
              locations={gradients.heroLocations}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {item.image ? (
              <Image source={item.image} style={styles.photo} contentFit="cover" contentPosition="right center" />
            ) : (
              <View style={styles.photoIcon} pointerEvents="none">
                <Feather name="shield" size={96} color="rgba(255,255,255,0.12)" />
              </View>
            )}
            <LinearGradient
              colors={["rgba(72,22,98,0.97)", "rgba(112,34,104,0.78)", "rgba(190,70,50,0)"]}
              locations={[0.28, 0.48, 0.8]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.copy}>
              <Text style={styles.tag} numberOfLines={1}>{item.tag.toUpperCase()}</Text>
              <Text
                style={[styles.title, { fontSize: item.titleSize, lineHeight: item.titleSize + 3 }]}
                numberOfLines={item.titleSize > 24 ? 1 : 3}
              >
                {item.title}
              </Text>
              <Text style={styles.sub} numberOfLines={2}>{item.sub}</Text>
              <View style={styles.ctaPill}>
                <Text style={styles.ctaText}>{item.cta}</Text>
                <Feather name="arrow-right" size={13} color="#2A1445" />
              </View>
            </View>
          </Pressable>
        )}
      />
      <View style={styles.dots} pointerEvents="none">
        {slides.map((slide, index) => (
          <View key={slide.id} style={[styles.dot, index === activeIndex ? styles.dotActive : null]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: mock.cardBorderWarm,
  },
  photo: { position: "absolute", right: 0, top: 0, bottom: 0, width: "74%" },
  photoIcon: { position: "absolute", right: 24, top: 0, bottom: 0, justifyContent: "center" },
  copy: {
    position: "absolute",
    left: 16,
    top: 12,
    bottom: 20,
    width: 215,
    justifyContent: "center",
    gap: 3,
  },
  tag: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.5, color: "#D9D0EA" },
  title: { fontFamily: fonts.displayBold, color: "#fff", letterSpacing: -0.2 },
  sub: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: "#E8E0F5" },
  ctaPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    height: 30,
    marginTop: 6,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: "#fff",
  },
  ctaText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: "#2A1445" },
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { width: 16, backgroundColor: "#FF9A3D" },
});
