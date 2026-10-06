import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { ArtistCard } from "@/components/ArtistCard";
import { Skeleton } from "@/components/Skeleton";
import { getSeasonalArt } from "@/components/SeasonalArt";
import { fetchSeasonPage, type ArtistSummary, type SeasonPage, type VendorSummary } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, gradients, mock, radii, spacing } from "@/theme";

const GAP = 12;

// One season's page (Diwali, Sufi, Wedding...): artists matched by the
// backend's rules, vendors when any exist, and "Last minute picks". Every
// section is hidden when empty; if nothing at all comes back the screen shows
// a way out to Browse instead of a blank page.
export default function SeasonPageScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.md * 2 - GAP) / 2;
  const [page, setPage] = useState<SeasonPage | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    if (!key) return;
    fetchSeasonPage(key)
      .then((result) => {
        setPage(result);
        setStatus("ready");
      })
      .catch((err) => {
        captureError(err, "season-page-fetch");
        setStatus("error");
      });
  }, [key]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const label = page?.season.label ?? null;
  const art = label ? getSeasonalArt(label) : null;
  const lm = page?.lastMinute;
  const hasAnything = Boolean(page && (page.artists.length || page.vendors.length || lm?.artists.length || lm?.vendors.length));
  const openArtist = (id: string) => router.push({ pathname: "/artist/[id]", params: { id } });
  const openVendor = (id: string) => router.push({ pathname: "/vendor/[id]", params: { id } });

  return (
    <GradientBackground variant="giggifi">
      <Stack.Screen options={{ title: label ?? "Season" }} />
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {status === "loading" ? (
          <View style={styles.pad}>
            <Skeleton height={150} borderRadius={24} />
            <View style={styles.skeletonRow}>
              <Skeleton height={190} borderRadius={radii.xl} style={styles.flex1} />
              <Skeleton height={190} borderRadius={radii.xl} style={styles.flex1} />
            </View>
          </View>
        ) : status === "error" || !hasAnything ? (
          <View style={styles.centered}>
            <Feather name="calendar" size={24} color={colors.textMute} />
            <Text style={styles.muted}>
              {status === "error" ? "This page isn't available right now." : "Nobody to show for this event yet."}
            </Text>
            <Pressable style={styles.cta} onPress={() => router.replace("/(tabs)/browse")}>
              <Feather name="compass" size={13} color={colors.pink} />
              <Text style={styles.ctaText}>Browse artists</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              {art ? (
                <Image source={art} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={["rgba(12,9,20,0.1)", "rgba(12,9,20,0.88)"]} locations={[0.2, 1]} style={StyleSheet.absoluteFill} />
              <Text style={styles.heroKicker}>{"Book for".toUpperCase()}</Text>
              <Text style={styles.heroTitle}>{label}</Text>
              <Text style={styles.heroSub}>Artists who perform at {label} events</Text>
            </View>

            {page && page.artists.length > 0 ? (
              <Section title="Artists" sub={`${page.artists.length} for you today`}>
                <Grid>
                  {page.artists.map((a: ArtistSummary) => (
                    <ArtistCard key={a.id} artist={a} width={cardWidth} onPress={() => openArtist(a.id)} />
                  ))}
                </Grid>
              </Section>
            ) : null}

            {page && page.vendors.length > 0 ? (
              <Section title="Vendors" sub={`For your ${label} plans`}>
                <Grid>
                  {page.vendors.map((v: VendorSummary) => (
                    <ArtistCard key={v.id} vendor={v} width={cardWidth} onPress={() => openVendor(v.id)} />
                  ))}
                </Grid>
              </Section>
            ) : null}

            {lm && (lm.artists.length > 0 || lm.vendors.length > 0) ? (
              <Section title="Last minute picks" sub="Fits almost any event">
                <Grid>
                  {lm.artists.map((a: ArtistSummary) => (
                    <ArtistCard key={a.id} artist={a} width={cardWidth} onPress={() => openArtist(a.id)} />
                  ))}
                  {lm.vendors.map((v: VendorSummary) => (
                    <ArtistCard key={v.id} vendor={v} width={cardWidth} onPress={() => openVendor(v.id)} />
                  ))}
                </Grid>
              </Section>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSub}>{sub}</Text>
      </View>
      {children}
    </View>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: spacing.md, gap: GAP },
  skeletonRow: { flexDirection: "row", gap: GAP },
  flex1: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.xl },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, textAlign: "center" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.pink,
  },
  ctaText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.pink },
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  hero: {
    height: 150,
    borderRadius: 24,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: mock.cardBorderWarm,
  },
  heroKicker: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.5, color: "#D9D0EA" },
  heroTitle: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 34, color: "#fff" },
  heroSub: { fontFamily: fonts.body, fontSize: 12, color: "#E8E0F5", marginTop: 2 },
  section: { gap: 10 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.text },
  sectionSub: { fontFamily: fonts.body, fontSize: 11.5, color: mock.textSoft },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
});
