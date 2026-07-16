import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { fetchArtist, sendEnquiry, ApiError, type ArtistSummary } from "@/lib/api";
import { duotoneFor } from "@/lib/palette";
import { colors, fonts, radii, spacing } from "@/theme";

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [artist, setArtist] = useState<ArtistSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [eventType, setEventType] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchArtist(id)
      .then(({ artist: result }) => {
        setArtist(result);
        setEventCity(result.city ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this artist."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmitEnquiry() {
    if (!artist || !eventType || !eventCity) return;
    setSubmitting(true);
    setFormError("");
    try {
      await sendEnquiry({ artistId: artist.id, eventType, eventCity, specialRequests: specialRequests || undefined });
      setSent(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not send enquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator color={colors.pink} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (error || !artist) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.muted}>{error || "Artist not found."}</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const name = artist.stageName ?? "GiggFi Artist";
  const initial = name.trim().charAt(0).toUpperCase();
  const [c1, c2] = duotoneFor(artist.id);
  const chips = [...artist.genres, ...artist.eventTypes].slice(0, 8);

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {artist.profileImageUrl ? (
            <Image source={{ uri: artist.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
              <Text style={styles.heroInitial}>{initial}</Text>
            </LinearGradient>
          )}
        </View>

        <View style={styles.body}>
          {artist.performerType ? <Text style={styles.tagline}>{artist.performerType.toUpperCase()}</Text> : null}
          <Text style={styles.name}>{name}</Text>

          {artist.city ? (
            <View style={styles.row}>
              <Feather name="map-pin" size={13} color={colors.textMute} />
              <Text style={styles.loc}>{artist.city}{artist.state ? `, ${artist.state}` : ""}</Text>
            </View>
          ) : null}

          {artist.bio ? <Text style={styles.bio}>{artist.bio}</Text> : null}

          <View style={styles.statsRow}>
            {artist.yearsExperience ? <Stat label="YEARS" value={String(artist.yearsExperience)} /> : null}
            {artist.languages.length ? <Stat label="LANGUAGES" value={String(artist.languages.length)} /> : null}
            <Stat label="TRAVEL" value={artist.travelAvailable ? "Yes" : "Local"} />
          </View>

          {chips.length ? (
            <View style={styles.chipRow}>
              {chips.map((chip) => (
                <View key={chip} style={styles.chip}>
                  <Text style={styles.chipText}>{chip}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <GlassCard style={styles.priceCard}>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>STARTING AT</Text>
                <Text style={styles.price}>{artist.ratePerEvent ? `₹${artist.ratePerEvent.toLocaleString("en-IN")}` : "On request"}</Text>
              </View>
              {artist.priceNegotiable ? (
                <View style={styles.negotiableBadge}>
                  <Text style={styles.negotiableText}>Negotiable</Text>
                </View>
              ) : null}
            </View>

            {sent ? (
              <View style={styles.sentBox}>
                <Feather name="check-circle" size={18} color={colors.ok} />
                <Text style={styles.sentText}>Enquiry sent — {name.split(" ")[0]} will respond soon.</Text>
              </View>
            ) : showForm ? (
              <View style={styles.form}>
                <FormField label="EVENT TYPE" value={eventType} onChangeText={setEventType} placeholder="Wedding, Birthday, Corporate…" />
                <FormField label="EVENT CITY" value={eventCity} onChangeText={setEventCity} placeholder="Mumbai" />
                <FormField label="NOTES (OPTIONAL)" value={specialRequests} onChangeText={setSpecialRequests} placeholder="Anything the artist should know" multiline />
                {formError ? <Text style={styles.error}>{formError}</Text> : null}
                <Btn label="Send Enquiry" onPress={handleSubmitEnquiry} disabled={!eventType || !eventCity} loading={submitting} style={styles.formButton} />
              </View>
            ) : (
              <Btn label="Send Enquiry" onPress={() => setShowForm(true)} style={styles.formButton} />
            )}

            <View style={styles.escrow}>
              <Feather name="shield" size={16} color={colors.purple} />
              <Text style={styles.escrowText}>Payments are held securely until the event is confirmed done.</Text>
            </View>
          </GlassCard>
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FormField({
  label,
  multiline,
  ...props
}: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textMute}
        style={[styles.fieldInput, multiline ? styles.fieldInputMultiline : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: spacing.xxl },
  hero: { aspectRatio: 1, position: "relative" },
  heroInitial: {
    flex: 1,
    textAlign: "center",
    textAlignVertical: "center",
    fontFamily: fonts.display,
    fontSize: 160,
    color: "rgba(255,255,255,0.16)",
  },
  body: { padding: spacing.lg, marginTop: -radii.xl, backgroundColor: colors.ink, borderTopLeftRadius: radii.xl * 1.5, borderTopRightRadius: radii.xl * 1.5 },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.orange,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  loc: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute },
  bio: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.textDim,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginBottom: spacing.lg,
  },
  stat: { gap: 2 },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMute,
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.textMute,
  },
  priceCard: { gap: spacing.md },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  priceLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  price: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
  },
  negotiableBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(34,197,94,0.15)",
  },
  negotiableText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.ok,
  },
  formButton: {},
  form: { gap: spacing.sm },
  field: { gap: 4 },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  fieldInputMultiline: { minHeight: 70, textAlignVertical: "top" },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.err },
  sentBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sentText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  escrow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  escrowText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMute },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute },
});
