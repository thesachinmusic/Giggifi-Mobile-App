import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { TimeField } from "@/components/TimeField";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationCategory,
  type NotificationPreferences,
} from "@/lib/api";
import { CATEGORY_META } from "@/lib/notification-category-meta";
import { CURRENT_MARKETING_CONSENT_VERSION, MARKETING_CONSENT_TEXT } from "@/lib/marketing-consent";
import { getLanguagePreference, setLanguagePreference, type Language } from "@/lib/local-preferences-storage";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const LOCKED_CATEGORIES: NotificationCategory[] = ["BOOKING", "PAYMENT", "EVENT_DAY", "SECURITY", "SUPPORT"];

const LANGUAGES: { key: Language; label: string }[] = [
  { key: "en", label: "English" },
  { key: "hi", label: "हिंदी" },
  { key: "mr", label: "मराठी" },
];

type PermissionStatus = "granted" | "denied" | "undetermined";

export default function NotificationSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = useState<PermissionStatus>("undetermined");
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    Promise.all([fetchNotificationPreferences(), getLanguagePreference()])
      .then(([preferences, lang]) => {
        setPrefs(preferences);
        setLanguage(lang);
      })
      .catch((err) => captureError(err, "notification-settings-fetch"))
      .finally(() => setLoading(false));
  }, []);

  // Re-check every time this screen regains focus — the user may have just
  // come back from the OS Settings app after enabling notifications there.
  useFocusEffect(
    useCallback(() => {
      Notifications.getPermissionsAsync()
        .then(({ status }) => setPermission(status as PermissionStatus))
        .catch((err) => captureError(err, "notification-permission-check-focus"));
    }, []),
  );

  async function toggleOffer(next: boolean) {
    if (!prefs) return;
    const prevPrefs = prefs;
    setPrefs({ ...prefs, categories: { ...prefs.categories, OFFER: next } });
    try {
      await updateNotificationPreferences({
        categories: { OFFER: next },
        marketingConsent: { granted: next, consentTextVersion: CURRENT_MARKETING_CONSENT_VERSION },
      });
    } catch {
      setPrefs(prevPrefs);
    }
  }

  async function changeQuietHours(field: "quietHoursStart" | "quietHoursEnd", hour: number) {
    if (!prefs) return;
    const prevPrefs = prefs;
    setPrefs({ ...prefs, [field]: hour });
    try {
      await updateNotificationPreferences({ [field]: hour });
    } catch {
      setPrefs(prevPrefs);
    }
  }

  async function changeLanguage(next: Language) {
    setLanguage(next);
    await setLanguagePreference(next);
  }

  if (loading || !prefs) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["bottom"]}>
          <ActivityIndicator color={colors.pink} style={styles.loader} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {permission !== "granted" ? (
            <Pressable onPress={() => Linking.openSettings()}>
              <GlassCard style={styles.permissionCard}>
                <Feather name="bell-off" size={18} color={colors.orange} />
                <View style={styles.permissionTextWrap}>
                  <Text style={styles.permissionTitle}>Notifications are off</Text>
                  <Text style={styles.permissionSub}>Tap to enable them for GiggiFi in Settings.</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMute} />
              </GlassCard>
            </Pressable>
          ) : null}

          <SectionTitle>Booking & account</SectionTitle>
          <GlassCard style={styles.card}>
            {LOCKED_CATEGORIES.map((category, i) => {
              const meta = CATEGORY_META[category];
              return (
                <View key={category} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Feather name={meta.icon} size={16} color={meta.color} style={styles.rowIcon} />
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowLabel}>{meta.label}</Text>
                    <Text style={styles.rowNote}>Required for your bookings</Text>
                  </View>
                  <Switch value disabled trackColor={{ true: colors.purple, false: colors.line }} />
                </View>
              );
            })}
          </GlassCard>

          <SectionTitle>Offers & updates</SectionTitle>
          <GlassCard style={styles.card}>
            <Text style={styles.benefitText}>Get told first about new artists, price drops and festive offers.</Text>
            <Text style={styles.consentText}>{MARKETING_CONSENT_TEXT}</Text>
            <View style={[styles.row, styles.rowBorder]}>
              <Feather name={CATEGORY_META.OFFER.icon} size={16} color={CATEGORY_META.OFFER.color} style={styles.rowIcon} />
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>Offers & Updates</Text>
              </View>
              <Switch
                value={prefs.categories.OFFER}
                onValueChange={toggleOffer}
                trackColor={{ true: colors.purple, false: colors.line }}
              />
            </View>
          </GlassCard>

          <SectionTitle>Quiet hours</SectionTitle>
          <GlassCard style={styles.card}>
            <Text style={styles.cardSub}>We won't send non-urgent notifications during these hours.</Text>
            <View style={styles.quietHoursRow}>
              <TimeField label="From" hour={prefs.quietHoursStart} onChange={(h) => changeQuietHours("quietHoursStart", h)} />
              <TimeField label="To" hour={prefs.quietHoursEnd} onChange={(h) => changeQuietHours("quietHoursEnd", h)} />
            </View>
          </GlassCard>

          <SectionTitle>Language</SectionTitle>
          <GlassCard style={styles.card}>
            <View style={styles.languageRow}>
              {LANGUAGES.map((option) => (
                <Pressable
                  key={option.key}
                  style={[styles.languagePill, language === option.key && styles.languagePillActive]}
                  onPress={() => changeLanguage(option.key)}
                >
                  <Text style={[styles.languagePillText, language === option.key && styles.languagePillTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xs },
  permissionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  permissionTextWrap: { flex: 1, gap: 2 },
  permissionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  permissionSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: colors.textMute,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  card: { gap: 0, marginBottom: spacing.xs },
  cardSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim, lineHeight: 17, marginBottom: spacing.sm },
  benefitText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text, lineHeight: 18, marginBottom: spacing.xs },
  consentText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim, lineHeight: 18, marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 12,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowIcon: { width: 22, textAlign: "center" },
  rowTextWrap: { flex: 1, gap: 1 },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.text },
  rowNote: { fontFamily: fonts.body, fontSize: 11, color: colors.textMute },
  quietHoursRow: { flexDirection: "row", gap: spacing.sm },
  languageRow: { flexDirection: "row", gap: spacing.sm },
  languagePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.pill,
    alignItems: "center",
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  languagePillActive: {
    backgroundColor: colors.surface,
    borderColor: colors.purple,
  },
  languagePillText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMute },
  languagePillTextActive: { color: colors.text, fontFamily: fonts.bodySemiBold },
});
