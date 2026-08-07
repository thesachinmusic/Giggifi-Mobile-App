import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { duotoneFor } from "@/lib/palette";
import { fetchQuickMomentsMatch, ApiError, type QuickMomentMatch, type QuickMomentFormat } from "@/lib/api";
import { QUICK_MOMENT_FORMATS } from "@/lib/quick-moments";
import { colors, fonts, radii, spacing } from "@/theme";

export default function QuickMomentsBrowseScreen() {
  const [format, setFormat] = useState<QuickMomentFormat | null>(null);
  const [budget, setBudget] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<QuickMomentMatch[] | null>(null);

  async function handleFind() {
    if (!format) return;
    setLocating(true);
    setError("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location access is needed to find Quick Moments artists near you.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const { results: matched } = await fetchQuickMomentsMatch({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        budgetMax: budget ? Number(budget) : undefined,
      });
      setResults(matched);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't find nearby artists right now.");
    } finally {
      setLocating(false);
    }
  }

  function reset() {
    setResults(null);
    setError("");
  }

  function openArtist(item: QuickMomentMatch) {
    if (!format) return;
    router.push({
      pathname: "/quick-moments/book",
      params: {
        artistId: item.id,
        format,
        stageName: item.stageName ?? "",
        pricePerSlot: item.pricePerSlot != null ? String(item.pricePerSlot) : "",
      },
    });
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {results ? (
          <ScrollView contentContainerStyle={styles.resultsScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.resultsHeaderRow}>
              <Text style={styles.resultsTitle}>{results.length} artist{results.length === 1 ? "" : "s"} nearby</Text>
              <Pressable onPress={reset}><Text style={styles.startOver}>Start over</Text></Pressable>
            </View>
            {results.length === 0 ? (
              <Text style={styles.muted}>No one's offering Quick Moments in your area yet — try a wider budget.</Text>
            ) : (
              results.map((item) => <MatchCard key={item.id} item={item} onPress={() => openArtist(item)} />)
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.eyebrow}>GIGGIFI 20-20</Text>
            <Text style={styles.title}>Quick Moments</Text>
            <Text style={styles.subtitle}>
              A spontaneous ~15 minute performance, priced by the artist. Book with at least 2 hours' notice.
            </Text>

            <FormLabel text="PICK A MOMENT" />
            {QUICK_MOMENT_FORMATS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setFormat(f.key)}
                style={[styles.formatCard, format === f.key && styles.formatCardActive]}
              >
                <Text style={styles.formatEmoji}>{f.emoji}</Text>
                <View style={styles.formatBody}>
                  <Text style={styles.formatLabel}>{f.label}</Text>
                  <Text style={styles.formatBlurb}>{f.blurb}</Text>
                </View>
                {format === f.key ? <Feather name="check-circle" size={18} color={colors.pink} /> : null}
              </Pressable>
            ))}

            <FormLabel text="MAX BUDGET (OPTIONAL)" />
            <TextInput
              value={budget}
              onChangeText={(v) => setBudget(v.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 3000"
              placeholderTextColor={colors.textMute}
              keyboardType="number-pad"
              style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Btn
              label="Find nearby artists"
              onPress={handleFind}
              disabled={!format}
              loading={locating}
              style={styles.submitButton}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

function FormLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function MatchCard({ item, onPress }: { item: QuickMomentMatch; onPress: () => void }) {
  const name = item.stageName ?? "GiggiFi Artist";
  const initial = name.trim().charAt(0).toUpperCase();
  const [c1, c2] = duotoneFor(item.id);

  return (
    <Pressable style={styles.resultCard} onPress={onPress}>
      <View style={styles.resultImageWrap}>
        {item.profileImageUrl ? (
          <Image source={{ uri: item.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={[c1, c2]} style={StyleSheet.absoluteFill}>
            <Text style={styles.resultInitial}>{initial}</Text>
          </LinearGradient>
        )}
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.resultName} numberOfLines={1}>{name}</Text>
        <View style={styles.resultRow}>
          {item.performerType ? <Text style={styles.resultTag}>{item.performerType}</Text> : null}
          {item.city ? (
            <View style={styles.resultRow}>
              <Feather name="map-pin" size={11} color={colors.textMute} />
              <Text style={styles.resultLoc}>{item.city} · {item.distanceKm.toFixed(1)} km</Text>
            </View>
          ) : (
            <Text style={styles.resultLoc}>{item.distanceKm.toFixed(1)} km away</Text>
          )}
        </View>
        {item.pricePerSlot ? <Text style={styles.resultPrice}>₹{item.pricePerSlot.toLocaleString("en-IN")} / slot</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMute} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  form: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.orange,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textDim,
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  formatCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.xs,
  },
  formatCardActive: {
    borderColor: colors.pink,
    backgroundColor: "rgba(236,72,153,0.08)",
  },
  formatEmoji: { fontSize: 26 },
  formatBody: { flex: 1, gap: 2 },
  formatLabel: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.text },
  formatBlurb: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textMute },
  input: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.err, marginTop: spacing.xs },
  submitButton: { marginTop: spacing.lg },
  resultsScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  resultsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  resultsTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.text },
  startOver: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.pink },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, marginTop: spacing.lg },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.sm,
  },
  resultImageWrap: { width: 56, height: 56, borderRadius: radii.md, overflow: "hidden" },
  resultInitial: { flex: 1, textAlign: "center", textAlignVertical: "center", fontFamily: fonts.display, fontSize: 22, color: "rgba(255,255,255,0.2)" },
  resultBody: { flex: 1, gap: 3 },
  resultName: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.text },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  resultTag: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, textTransform: "uppercase" },
  resultLoc: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  resultPrice: { fontFamily: fonts.mono, fontSize: 12, color: colors.text, marginTop: 1 },
});
