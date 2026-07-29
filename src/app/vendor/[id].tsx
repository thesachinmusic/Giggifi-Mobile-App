import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { DateField } from "@/components/DateField";
import { RatingBadge } from "@/components/RatingBadge";
import { fetchVendor, sendVendorEnquiry, ApiError, type VendorSummary } from "@/lib/api";
import { duotoneFor } from "@/lib/palette";
import { colors, fonts, radii, spacing } from "@/theme";

export default function VendorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vendor, setVendor] = useState<VendorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [eventType, setEventType] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchVendor(id)
      .then(({ vendor: result }) => {
        setVendor(result);
        setEventCity(result.city ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this vendor."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmitEnquiry() {
    if (!vendor || !eventType || !eventCity || !description) return;
    setSubmitting(true);
    setFormError("");
    try {
      await sendVendorEnquiry({
        vendorId: vendor.id,
        eventType,
        eventCity,
        eventDate: eventDate?.toISOString(),
        description,
      });
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

  if (error || !vendor) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.muted}>{error || "Vendor not found."}</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const name = vendor.businessName ?? "GiggiFi Vendor";
  const initial = name.trim().charAt(0).toUpperCase();
  const [c1, c2] = duotoneFor(vendor.id);
  const chips = [vendor.category, ...vendor.subcategories].filter((c): c is string => Boolean(c)).slice(0, 8);

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={styles.scrollFlex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <VendorHero vendor={vendor} c1={c1} c2={c2} initial={initial} />

        <View style={styles.body}>
          {vendor.category ? <Text style={styles.tagline}>{vendor.category.toUpperCase()}</Text> : null}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            <RatingBadge rating={vendor.avgRating} size={14} />
          </View>

          {vendor.city ? (
            <View style={styles.row}>
              <Feather name="map-pin" size={13} color={colors.textMute} />
              <Text style={styles.loc}>{vendor.city}{vendor.state ? `, ${vendor.state}` : ""}</Text>
            </View>
          ) : null}

          {vendor.bio ? <Text style={styles.bio}>{vendor.bio}</Text> : null}

          <View style={styles.statsRow}>
            {vendor.yearsExperience ? <Stat label="YEARS" value={String(vendor.yearsExperience)} /> : null}
            {vendor.reviewCount ? <Stat label="REVIEWS" value={String(vendor.reviewCount)} /> : null}
            <Stat label="TRAVEL" value={vendor.travelAvailable ? "Yes" : "Local"} />
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

          {vendor.portfolioPhotos.length ? (
            <View style={styles.galleryBlock}>
              <Text style={styles.fieldLabel}>PORTFOLIO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                {vendor.portfolioPhotos.map((uri) => (
                  <Image key={uri} source={{ uri }} style={styles.galleryPhoto} contentFit="cover" />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <GlassCard style={styles.priceCard}>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>STARTING AT</Text>
                <Text style={styles.price}>{vendor.startingPrice ? `₹${vendor.startingPrice.toLocaleString("en-IN")}` : "On request"}</Text>
              </View>
              {vendor.priceNegotiable ? (
                <View style={styles.negotiableBadge}>
                  <Text style={styles.negotiableText}>Negotiable</Text>
                </View>
              ) : null}
            </View>

            {sent ? (
              <View style={styles.sentBox}>
                <Feather name="check-circle" size={18} color={colors.ok} />
                <Text style={styles.sentText}>Enquiry sent — {name} will respond soon.</Text>
              </View>
            ) : showForm ? (
              <View style={styles.form}>
                <FormField label="EVENT TYPE" value={eventType} onChangeText={setEventType} placeholder="Wedding, Birthday, Corporate…" />
                <FormField label="EVENT CITY" value={eventCity} onChangeText={setEventCity} placeholder="Mumbai" />
                <DateField label="EVENT DATE" value={eventDate} onChange={setEventDate} />
                <FormField label="WHAT DO YOU NEED?" value={description} onChangeText={setDescription} placeholder="Describe what you're looking for…" multiline />
                {formError ? <Text style={styles.error}>{formError}</Text> : null}
                <Btn
                  label="Send Enquiry"
                  onPress={handleSubmitEnquiry}
                  disabled={!eventType || !eventCity || !description}
                  loading={submitting}
                  style={styles.formButton}
                />
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
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

function VendorHero({ vendor, c1, c2, initial }: { vendor: VendorSummary; c1: string; c2: string; initial: string }) {
  const [muted, setMuted] = useState(true);
  const videoSource = vendor.portfolioVideoUrl ?? null;

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    if (!videoSource) return;
    let cancelled = false;
    player.replaceAsync(videoSource).then(() => {
      if (cancelled) return;
      player.muted = muted;
      player.play();
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [videoSource, player]);

  useEffect(() => {
    if (videoSource) player.muted = muted;
  }, [muted, player, videoSource]);

  return (
    <View style={styles.hero} pointerEvents="box-none">
      {videoSource ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
        </View>
      ) : vendor.profileImageUrl ? (
        <Image source={{ uri: vendor.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
          <Text style={styles.heroInitial}>{initial}</Text>
        </LinearGradient>
      )}
      {videoSource ? (
        <Pressable onPress={() => setMuted((v) => !v)} style={styles.heroMuteButton}>
          <Feather name={muted ? "volume-x" : "volume-2"} size={15} color="#fff" />
        </Pressable>
      ) : null}
    </View>
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
  scrollFlex: { flex: 1 },
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
  heroMuteButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryBlock: { marginBottom: spacing.lg, gap: spacing.xs },
  galleryRow: { gap: spacing.sm },
  galleryPhoto: { width: 120, height: 150, borderRadius: radii.md, backgroundColor: colors.surface },
  body: { padding: spacing.lg, marginTop: -radii.xl, backgroundColor: colors.ink, borderTopLeftRadius: radii.xl * 1.5, borderTopRightRadius: radii.xl * 1.5 },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.orange,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.sm },
  name: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.text,
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
