import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { KeyboardAvoidingScreen } from "@/components/KeyboardAvoidingScreen";
import { useAuth } from "@/lib/auth-context";
import { getBusinessDetails, setBusinessDetails, type BusinessDetails, type BusinessType } from "@/lib/business-storage";
import { BUSINESS_DEALS, BUSINESS_DEAL_TABS, type BusinessDealCategory, type BusinessDeal } from "@/lib/business-deals";
import { logBusinessDealInterest, syncBusinessDetails } from "@/lib/api";
import { HELPLINE_NUMBER } from "@/lib/constants";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const TYPE_OPTIONS: { key: BusinessType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "RESTAURANT", label: "Restaurant/Venue", icon: "coffee" },
  { key: "CORPORATE", label: "Corporate", icon: "briefcase" },
  { key: "EVENT_COMPANY", label: "Event Company", icon: "calendar" },
];

const VOLUME_RANGES = [
  { key: "1-5", label: "1–5 / month" },
  { key: "6-15", label: "6–15 / month" },
  { key: "16-30", label: "16–30 / month" },
  { key: "30-plus", label: "30+ / month" },
];

// The "Business" tab — decides form-vs-deals itself so the tab bar has one
// consistent destination, same shape as My Event Hub's create-vs-dashboard
// split. Business details are local-only for now (see business-storage.ts's
// own comment on why) — that's already enough to satisfy "don't re-ask on
// repeat visits" without needing the still-pending BookerType/gstNumber
// backend decisions.
export default function BusinessScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<BusinessDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBusinessDetails().then((d) => {
      if (cancelled) return;
      setDetails(d);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.centered}>
            <ActivityIndicator color={colors.pink} />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!details) {
    return <BusinessDetailsForm phone={user?.phone ?? null} onSubmitted={setDetails} />;
  }

  return <BusinessDealsScreen details={details} />;
}

function BusinessDetailsForm({ phone, onSubmitted }: { phone: string | null; onSubmitted: (d: BusinessDetails) => void }) {
  const [type, setType] = useState<BusinessType | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [volume, setVolume] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = type !== null && businessName.trim().length > 0 && city.trim().length > 0 && volume !== null;

  async function handleSubmit() {
    if (!canSubmit || !type || !volume) return;
    setSubmitting(true);
    const details: BusinessDetails = { type, businessName: businessName.trim(), city: city.trim(), monthlyVolume: volume };
    try {
      await setBusinessDetails(details);
      onSubmitted(details);
    } catch (err) {
      captureError(err, "business-details-save");
    } finally {
      setSubmitting(false);
    }
    // Best-effort, after the local save already unblocked the user — a
    // failure here (offline, no BookerProfile yet) must never stop them
    // from reaching their deals, which local storage already handles.
    const volumeLabel = VOLUME_RANGES.find((v) => v.key === volume)?.label ?? volume;
    syncBusinessDetails({ bookerType: type, businessName: details.businessName, city: details.city, monthlyVolume: volumeLabel }).catch(
      (err) => captureError(err, "business-details-sync"),
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topbar}>
          <Text style={styles.tbName}>Business</Text>
        </View>
        <KeyboardAvoidingScreen verticalOffset={80}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.signedInRow}>
              <Feather name="check-circle" size={14} color={colors.ok} />
              <Text style={styles.signedInText}>
                {phone ? `Signed in as +${phone.replace(/^\+/, "")}` : "Signed in"} — no separate business signup needed.
              </Text>
            </View>

            <Text style={styles.heroTitle}>Tell us about your business</Text>
            <Text style={styles.heroSub}>A couple of quick details, then straight to curated deals.</Text>

            <Text style={styles.fieldLabel}>BUSINESS TYPE</Text>
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map((opt) => {
                const selected = type === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.typeCard, selected && styles.typeCardSelected]}
                    onPress={() => setType(opt.key)}
                  >
                    <Feather name={opt.icon} size={18} color={selected ? "#fff" : colors.textDim} />
                    <Text style={[styles.typeCardText, selected && styles.typeCardTextSelected]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>BUSINESS / RESTAURANT NAME</Text>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. The Sunset Terrace"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>CITY</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Mumbai"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>ROUGH MONTHLY BOOKING VOLUME</Text>
            <View style={styles.volumeRow}>
              {VOLUME_RANGES.map((v) => {
                const selected = volume === v.key;
                return (
                  <Pressable
                    key={v.key}
                    style={[styles.volumeChip, selected && styles.volumeChipSelected]}
                    onPress={() => setVolume(v.key)}
                  >
                    <Text style={[styles.volumeChipText, selected && styles.volumeChipTextSelected]}>{v.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Btn
              label="See curated deals →"
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
              style={styles.submitButton}
            />
          </ScrollView>
        </KeyboardAvoidingScreen>
      </SafeAreaView>
    </GradientBackground>
  );
}

function BusinessDealsScreen({ details }: { details: BusinessDetails }) {
  const [activeTab, setActiveTab] = useState<BusinessDealCategory>(
    details.type === "RESTAURANT" ? "restaurants" : details.type === "EVENT_COMPANY" ? "eventCompanies" : "corporates",
  );

  // Reuses the existing helpline number (already the app's one real
  // support contact channel — see booking/[id].tsx's "Need help?" card)
  // over WhatsApp instead of a phone call, which fits a B2B "talk to us"
  // CTA better than a cold call — not a new contact mechanism.
  function handleTalkToUs(deal: BusinessDeal) {
    logBusinessDealInterest(activeTab, deal.id).catch((err) => captureError(err, "business-deal-interest-log"));
    const tabLabel = BUSINESS_DEAL_TABS.find((t) => t.key === activeTab)?.label ?? activeTab;
    const message = encodeURIComponent(`Hi! I'm interested in the "${deal.headline}" deal for ${tabLabel}.`);
    Linking.openURL(`https://wa.me/91${HELPLINE_NUMBER}?text=${message}`).catch((err) =>
      captureError(err, "business-deal-whatsapp-open"),
    );
  }

  const deals = BUSINESS_DEALS[activeTab];

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topbar}>
          <Text style={styles.tbName}>Business Deals</Text>
        </View>

        <View style={styles.dealTabRow}>
          {BUSINESS_DEAL_TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <Pressable
                key={t.key}
                style={[styles.dealTab, active && styles.dealTabActive]}
                onPress={() => setActiveTab(t.key)}
              >
                <Text style={[styles.dealTabText, active && styles.dealTabTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.dealsScroll} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.orgEntryCard} onPress={() => router.push("/organizations")}>
            <View style={styles.orgEntryIcon}>
              <Feather name="users" size={16} color={colors.purple} />
            </View>
            <View style={styles.orgEntryText}>
              <Text style={styles.orgEntryTitle}>Business Account</Text>
              <Text style={styles.orgEntrySub}>Team members, billing & GSTIN, multi-outlet bookings</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMute} />
          </Pressable>

          <View style={styles.disclaimerBox}>
            <Feather name="info" size={13} color={colors.textMute} />
            <Text style={styles.disclaimerText}>Example deals — final terms to be confirmed.</Text>
          </View>

          {deals.map((deal) => (
            <GlassCard key={deal.id} style={styles.dealCard}>
              <View style={styles.dealTagPill}>
                <Text style={styles.dealTagText}>{deal.tag.toUpperCase()}</Text>
              </View>
              <Text style={styles.dealHeadline}>{deal.headline}</Text>
              <Text style={styles.dealBody}>{deal.body}</Text>
              <Pressable style={styles.dealCta} onPress={() => handleTalkToUs(deal)}>
                <Text style={styles.dealCtaText}>Talk to us</Text>
                <Feather name="arrow-right" size={14} color={colors.purple} />
              </Pressable>
            </GlassCard>
          ))}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  topbar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  tbName: { fontFamily: fonts.display, fontWeight: "600", fontSize: 16, color: "#fff" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  signedInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  signedInText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  heroTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.text, marginBottom: 4 },
  heroSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, marginBottom: spacing.lg },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5, marginBottom: 8, marginTop: spacing.sm },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: spacing.xs },
  typeCard: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  typeCardSelected: { backgroundColor: colors.purple, borderColor: colors.purple },
  typeCardText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.textDim, textAlign: "center" },
  typeCardTextSelected: { color: "#fff" },
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
  volumeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  volumeChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  volumeChipSelected: { backgroundColor: colors.purple, borderColor: colors.purple },
  volumeChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textDim },
  volumeChipTextSelected: { color: "#fff" },
  submitButton: { marginTop: spacing.lg },
  dealTabRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.ink2,
    borderRadius: radii.pill,
    padding: 4,
    gap: 4,
  },
  dealTab: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: radii.pill },
  dealTabActive: { backgroundColor: colors.purple },
  dealTabText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMute },
  dealTabTextActive: { color: "#fff" },
  dealsScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  disclaimerText: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.textMute, fontStyle: "italic" },
  orgEntryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(168,85,247,0.08)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.25)",
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  orgEntryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(168,85,247,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  orgEntryText: { flex: 1, gap: 2 },
  orgEntryTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  orgEntrySub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMute },
  dealCard: { padding: spacing.md, gap: 6, marginBottom: spacing.sm },
  dealTagPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(168,85,247,0.16)",
  },
  dealTagText: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.purple, letterSpacing: 0.5 },
  dealHeadline: { fontFamily: fonts.display, fontSize: 16, color: colors.text },
  dealBody: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textDim },
  dealCta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dealCtaText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.purple },
});
