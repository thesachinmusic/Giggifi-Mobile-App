import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { CategoryPill } from "@/components/CategoryPill";
import { CATEGORIES } from "@/lib/categories";
import { VENDOR_CATEGORIES } from "@/lib/vendor-categories";
import { duotoneFor } from "@/lib/palette";
import { fetchMatch, ApiError, type MatchResult } from "@/lib/api";
import { colors, fonts, radii, spacing } from "@/theme";

type Kind = "artist" | "vendor";
type BudgetKey = "under-25k" | "25k-50k" | "50k-1l" | "1l-3l" | "3l-plus";

const BUDGETS: { key: BudgetKey; label: string }[] = [
  { key: "under-25k", label: "Under ₹25k" },
  { key: "25k-50k", label: "₹25k – ₹50k" },
  { key: "50k-1l", label: "₹50k – ₹1L" },
  { key: "1l-3l", label: "₹1L – ₹3L" },
  { key: "3l-plus", label: "₹3L+" },
];

// v1 "AI" scope: a stepper UI over the existing rules-based match engine
// (category + budget + city fit) — no LLM call, keeps this launch-safe.
export default function AskGiggFiScreen() {
  const [kind, setKind] = useState<Kind>("artist");
  const [type, setType] = useState<string | null>(null);
  const [eventType, setEventType] = useState("");
  const [city, setCity] = useState("");
  const [budgetKey, setBudgetKey] = useState<BudgetKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<MatchResult[] | null>(null);

  const categoryOptions = kind === "artist" ? CATEGORIES.map((c) => c.label) : VENDOR_CATEGORIES.map((c) => c.label);
  const canSearch = Boolean(type && budgetKey);

  async function handleSearch() {
    if (!type || !budgetKey) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const { results: matched } = await fetchMatch({
        kind,
        type,
        eventType: eventType || undefined,
        city: city || undefined,
        budgetKey,
      });
      setResults(matched);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't find matches right now.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setType(null);
    setEventType("");
    setCity("");
    setBudgetKey(null);
    setResults(null);
    setError("");
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ASK GIGGIFI</Text>
            <Text style={styles.title}>What are you planning?</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            style={styles.closeButton}
            hitSlop={7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Feather name="x" size={18} color={colors.text} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
          style={styles.flex}
        >
        {results ? (
          <ScrollView contentContainerStyle={styles.resultsScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.resultsHeaderRow}>
              <Text style={styles.resultsTitle}>{results.length} matches for you</Text>
              <Pressable onPress={reset}><Text style={styles.startOver}>Start over</Text></Pressable>
            </View>
            {results.length === 0 ? (
              <Text style={styles.muted}>No matches yet — try a wider budget or a nearby city.</Text>
            ) : (
              results.map((item) => <MatchResultCard key={item.id} item={item} kind={kind} />)
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.toggle}>
              <Pressable style={[styles.toggleTab, kind === "artist" && styles.toggleTabActive]} onPress={() => { setKind("artist"); setType(null); }}>
                <Text style={[styles.toggleText, kind === "artist" && styles.toggleTextActive]}>An Artist</Text>
              </Pressable>
              <Pressable style={[styles.toggleTab, kind === "vendor" && styles.toggleTabActive]} onPress={() => { setKind("vendor"); setType(null); }}>
                <Text style={[styles.toggleText, kind === "vendor" && styles.toggleTextActive]}>A Vendor</Text>
              </Pressable>
            </View>

            <FormLabel text={kind === "artist" ? "WHAT KIND OF ACT?" : "WHAT KIND OF SERVICE?"} />
            <View style={styles.pillWrap}>
              {categoryOptions.map((label) => (
                <CategoryPill key={label} label={label} active={type === label} onPress={() => setType(label)} />
              ))}
            </View>

            {kind === "artist" ? (
              <>
                <FormLabel text="OCCASION (OPTIONAL)" />
                <TextInput
                  value={eventType}
                  onChangeText={setEventType}
                  placeholder="Wedding, Birthday, Corporate…"
                  placeholderTextColor={colors.textMute}
                  style={styles.input}
                />
              </>
            ) : null}

            <FormLabel text="CITY (OPTIONAL)" />
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Mumbai"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />

            <FormLabel text="YOUR BUDGET" />
            <View style={styles.pillWrap}>
              {BUDGETS.map((b) => (
                <CategoryPill key={b.key} label={b.label} active={budgetKey === b.key} onPress={() => setBudgetKey(b.key)} />
              ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Btn label="Find my match" onPress={handleSearch} disabled={!canSearch} loading={loading} style={styles.submitButton} />
          </ScrollView>
        )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function FormLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function MatchResultCard({ item, kind }: { item: MatchResult; kind: Kind }) {
  const name = (item.stageName as string | undefined) ?? (item.businessName as string | undefined) ?? "GiggiFi";
  const initial = name.trim().charAt(0).toUpperCase();
  const [c1, c2] = duotoneFor(item.id);
  const price = (item.ratePerEvent as number | null | undefined) ?? (item.startingPrice as number | null | undefined);

  return (
    <Pressable
      style={styles.resultCard}
      onPress={() => router.push({ pathname: kind === "artist" ? "/artist/[id]" : "/vendor/[id]", params: { id: item.id } })}
    >
      <View style={styles.resultImageWrap}>
        {item.profileImageUrl ? (
          <Image source={{ uri: item.profileImageUrl as string }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={[c1, c2]} style={StyleSheet.absoluteFill}>
            <Text style={styles.resultInitial}>{initial}</Text>
          </LinearGradient>
        )}
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.resultName} numberOfLines={1}>{name}</Text>
        {item.city ? (
          <View style={styles.resultRow}>
            <Feather name="map-pin" size={11} color={colors.textMute} />
            <Text style={styles.resultLoc}>{item.city}</Text>
          </View>
        ) : null}
        {price ? <Text style={styles.resultPrice}>₹{price.toLocaleString("en-IN")} / event</Text> : null}
        {item.matchReasons.length > 0 ? (
          <View style={styles.reasonRow}>
            {item.matchReasons.slice(0, 2).map((reason) => (
              <View key={reason} style={styles.reasonChip}>
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.orange,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  form: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  toggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
  },
  toggleTab: { flex: 1, paddingVertical: 10, borderRadius: radii.pill, alignItems: "center" },
  toggleTabActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  toggleText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.textMute },
  toggleTextActive: { color: colors.text, fontFamily: fonts.bodySemiBold },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xs },
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
  resultsScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  resultsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  resultsTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.text },
  startOver: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.pink },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, marginTop: spacing.lg },
  resultCard: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.sm,
  },
  resultImageWrap: { width: 72, height: 72, borderRadius: radii.md, overflow: "hidden" },
  resultInitial: { flex: 1, textAlign: "center", textAlignVertical: "center", fontFamily: fonts.display, fontSize: 28, color: "rgba(255,255,255,0.2)" },
  resultBody: { flex: 1, gap: 3, justifyContent: "center" },
  resultName: { fontFamily: fonts.displayMedium, fontSize: 15.5, color: colors.text },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  resultLoc: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  resultPrice: { fontFamily: fonts.mono, fontSize: 12, color: colors.text },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  reasonChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.pill, backgroundColor: "rgba(34,197,94,0.15)" },
  reasonText: { fontFamily: fonts.mono, fontSize: 9, color: colors.ok },
});
