import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { ScreenTitle } from "@/components/ScreenTitle";
import { InlinePhoneVerification } from "@/components/InlinePhoneVerification";
import { useAuth } from "@/lib/auth-context";
import { fetchMyProfile, type BookerProfile } from "@/lib/api";
import { HELPLINE_NUMBER } from "@/lib/constants";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, mock, mockGradients, spacing, radii } from "@/theme";

// Official grievance / support address (confirmed). Phone and WhatsApp reuse
// the existing helpline constant.
const SUPPORT_EMAIL = "admin@giggifi.com";

const PROFILE_FIELDS = 5; // fullName, email, city, state, photo (companyName is optional, excluded)

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [bookerProfile, setBookerProfile] = useState<BookerProfile | null | undefined>(undefined);
  const [profileFetchError, setProfileFetchError] = useState(false);

  const loadProfile = useCallback(() => {
    if (!user || user.role === "ARTIST") return;
    setProfileFetchError(false);
    fetchMyProfile()
      .then(({ bookerProfile: result }) => setBookerProfile(result))
      // Leaving bookerProfile as undefined (not null) on failure — null means
      // "confirmed no profile exists," which would wrongly show the
      // Complete-your-profile nudge to someone who already has one.
      .catch(() => setProfileFetchError(true));
  }, [user?.role]);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  function handleLogout() {
    Alert.alert("Log out?", "You'll need to verify your phone number again to sign back in.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          // Deliberately no navigation after this — staying on Profile
          // means the screen re-renders straight into the logged-out card
          // below (the actual confirmation that anything happened), rather
          // than bouncing to Home where a logged-out state looks identical
          // to a logged-in one and reads as "the button did nothing."
          await logout();
        },
      },
    ]);
  }

  // Help and support — same helpline wiring the old "Help & support" row used
  // (HELPLINE_NUMBER, itself overridable via EXPO_PUBLIC_HELPLINE_NUMBER).
  function handleEmail() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch((err) => captureError(err, "profile-support-email"));
  }
  function handleCall() {
    Linking.openURL(`tel:${HELPLINE_NUMBER}`).catch((err) => captureError(err, "profile-support-call"));
  }
  function handleWhatsApp() {
    Linking.openURL(`https://wa.me/91${HELPLINE_NUMBER}`).catch((err) => captureError(err, "profile-support-whatsapp"));
  }

  const initial = (user?.name ?? user?.phone ?? "G").trim().charAt(0).toUpperCase();

  const filledCount = bookerProfile
    ? [bookerProfile.fullName, bookerProfile.email, bookerProfile.city, bookerProfile.state, user?.image].filter(Boolean).length
    : 0;
  const completionPct = bookerProfile ? Math.round((filledCount / PROFILE_FIELDS) * 100) : 0;
  const showBookerProfileCard = user?.role !== "ARTIST" && bookerProfile !== undefined;

  const accountRows: MenuRowProps[] = user
    ? [
        ...(showBookerProfileCard && bookerProfile
          ? [{ icon: "edit-2" as const, label: "Edit profile", tint: "amber" as const, onPress: () => router.push("/booker-profile") }]
          : []),
        { icon: "calendar", label: "My bookings", tint: "lilac", onPress: () => router.push("/(tabs)/bookings") },
        { icon: "calendar", label: "My Event Hub", tint: "amber", onPress: () => router.push("/my-event") },
        { icon: "repeat", label: "Recurring bookings", tint: "lilac", onPress: () => router.push("/recurring-series") },
        { icon: "heart", label: "Saved artists", tint: "rose", onPress: () => router.push("/saved") },
        { icon: "bell", label: "Notification settings", sub: "Push status and alerts", tint: "amber", onPress: () => router.push("/notification-settings") },
      ]
    : [];
  const legalRows: MenuRowProps[] = [
    { icon: "file-text", label: "Terms of Service", tint: "lilac", onPress: () => Linking.openURL("https://giggifi.com/terms") },
    { icon: "shield", label: "Privacy Policy", tint: "amber", onPress: () => Linking.openURL("https://giggifi.com/privacy") },
    { icon: "rotate-ccw", label: "Refund Policy", tint: "rose", onPress: () => Linking.openURL("https://giggifi.com/refund") },
    { icon: "user-check", label: "Privacy Rights Request", tint: "lilac", onPress: () => Linking.openURL("https://giggifi.com/privacy-request") },
  ];

  return (
    <GradientBackground variant="giggifi">
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ScreenTitle title="Profile" accent="made for you" />

          {user ? (
            <LinearGradient
              colors={["rgba(255,138,61,0.22)", "rgba(166,107,255,0.22)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.userCard}
            >
              {user.image ? (
                <Image source={{ uri: user.image }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={mockGradients.ctaRose} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </LinearGradient>
              )}
              <View style={styles.userInfo}>
                <Text style={styles.name} numberOfLines={1}>{bookerProfile?.fullName ?? user.name ?? "GiggiFi user"}</Text>
                {user.phone ? <Text style={styles.meta}>+{user.phone.replace(/^\+/, "")}</Text> : null}
                {(bookerProfile?.email ?? user.email) ? <Text style={styles.meta} numberOfLines={1}>{bookerProfile?.email ?? user.email}</Text> : null}
                {user.role ? (
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{user.role === "ARTIST" ? "ARTIST" : "CLIENT"}</Text>
                  </View>
                ) : null}
              </View>
              {showBookerProfileCard && bookerProfile ? (
                <Pressable
                  style={styles.editButton}
                  onPress={() => router.push("/booker-profile")}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                >
                  <Feather name="edit-2" size={17} color="#fff" />
                </Pressable>
              ) : null}
              <Ionicons name="sparkles" size={22} color="#FFC27A" style={styles.sparkle} />
            </LinearGradient>
          ) : (
            // Logging out clears the session correctly (see auth-context.tsx's
            // logout()), but this app has no separate login screen to land
            // on afterward — (tabs) is browsable logged out or in (see
            // app/index.tsx's own comment) — so without this card, tapping
            // Log out silently left the same-looking menu on screen with
            // only a placeholder name swapped in, reading as "did nothing."
            // This makes the logged-out state unmistakable and gives an
            // actual way to sign back in right here, reusing the same
            // inline OTP component every booking flow already uses instead
            // of a dedicated login screen.
            <GlassCard style={styles.loggedOutCard}>
              <View style={styles.loggedOutIcon}>
                <Feather name="user" size={20} color={colors.textMute} />
              </View>
              <Text style={styles.loggedOutTitle}>You&apos;re browsing as a guest</Text>
              <Text style={styles.loggedOutSub}>Log in to see your bookings, saved artists, and profile.</Text>
              <InlinePhoneVerification onVerified={loadProfile} />
            </GlassCard>
          )}

          {user?.role !== "ARTIST" && profileFetchError ? (
            <GlassCard>
              <View style={styles.completeRow}>
                <View style={[styles.completeIcon, styles.errorIcon]}>
                  <Feather name="alert-circle" size={18} color={colors.err} />
                </View>
                <View style={styles.completeTextWrap}>
                  <Text style={styles.completeTitle}>Couldn&apos;t load your profile</Text>
                  <Text style={styles.completeSub}>Check your connection and try again.</Text>
                </View>
                <Pressable onPress={loadProfile} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retry">
                  <Feather name="refresh-cw" size={16} color={colors.textMute} />
                </Pressable>
              </View>
            </GlassCard>
          ) : showBookerProfileCard ? (
            !bookerProfile ? (
              <Pressable onPress={() => router.push("/booker-profile")}>
                <GlassCard>
                  <View style={styles.completeRow}>
                    <View style={styles.completeIcon}>
                      <Feather name="user-plus" size={18} color={colors.orange} />
                    </View>
                    <View style={styles.completeTextWrap}>
                      <Text style={styles.completeTitle}>Complete your profile</Text>
                      <Text style={styles.completeSub}>Add your details to book artists faster.</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.textMute} />
                  </View>
                </GlassCard>
              </Pressable>
            ) : completionPct < 100 ? (
              <Pressable onPress={() => router.push("/booker-profile")}>
                <GlassCard>
                  <View style={styles.completeRow}>
                    <View style={styles.progressRing}>
                      <Text style={styles.progressRingText}>{completionPct}%</Text>
                    </View>
                    <View style={styles.completeTextWrap}>
                      <Text style={styles.completeTitle}>Profile {completionPct}% complete</Text>
                      <Text style={styles.completeSub}>Finish your profile for a smoother booking experience.</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.textMute} />
                  </View>
                </GlassCard>
              </Pressable>
            ) : null
          ) : null}

          {accountRows.length > 0 ? <MenuGroup rows={accountRows} /> : null}

          <View style={styles.helpCard}>
            <View style={styles.helpHead}>
              <View style={[styles.chip, { backgroundColor: "rgba(255,79,123,0.2)" }]}>
                <Feather name="help-circle" size={20} color={mock.roseSoft} />
              </View>
              <View style={styles.helpHeadText}>
                <Text style={styles.helpTitle}>Help and support</Text>
                <Text style={styles.helpSub}>Talk to the Giggifi team one to one</Text>
              </View>
            </View>
            <Pressable style={styles.helpEmailRow} onPress={handleEmail} accessibilityRole="button" accessibilityLabel={`Email ${SUPPORT_EMAIL}`}>
              <Feather name="mail" size={18} color={mock.amber} />
              <Text style={styles.helpEmailText} numberOfLines={1}>{SUPPORT_EMAIL}</Text>
              <Text style={styles.helpEmailCta}>Email us</Text>
            </Pressable>
            <View style={styles.helpButtons}>
              <Pressable style={styles.helpCallWrap} onPress={handleCall} accessibilityRole="button" accessibilityLabel="Call us">
                <LinearGradient colors={mockGradients.ctaRose} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.helpCall}>
                  <Feather name="phone" size={16} color="#fff" />
                  <Text style={styles.helpButtonText}>Call us</Text>
                </LinearGradient>
              </Pressable>
              <Pressable style={styles.helpWhatsApp} onPress={handleWhatsApp} accessibilityRole="button" accessibilityLabel="WhatsApp us">
                <Feather name="message-circle" size={16} color="#7CF0A8" />
                <Text style={[styles.helpButtonText, { color: "#7CF0A8" }]}>WhatsApp</Text>
              </Pressable>
            </View>
          </View>

          <MenuGroup rows={legalRows} />

          {user ? (
            <>
              <Pressable onPress={handleLogout} style={styles.logout}>
                <Feather name="log-out" size={17} color="#FF9AA8" />
                <Text style={styles.logoutText}>Log out</Text>
              </Pressable>

              <Pressable onPress={() => router.push("/delete-account")} style={styles.deleteAccount}>
                <Text style={styles.deleteAccountText}>Delete account</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

type Tint = "amber" | "lilac" | "rose";
const TINT: Record<Tint, { bg: string; fg: string }> = {
  amber: { bg: "rgba(255,178,74,0.16)", fg: "#FFB24A" },
  lilac: { bg: "rgba(166,107,255,0.2)", fg: "#C9A6FF" },
  rose: { bg: "rgba(255,79,123,0.18)", fg: "#FF8AA8" },
};

interface MenuRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sub?: string;
  tint: Tint;
  onPress: () => void;
}

function MenuGroup({ rows }: { rows: MenuRowProps[] }) {
  return (
    <View style={styles.menu}>
      {rows.map((row, i) => (
        <Pressable key={row.label} onPress={row.onPress} style={[styles.menuRow, i < rows.length - 1 && styles.menuRowDivider]}>
          <View style={[styles.chip, { backgroundColor: TINT[row.tint].bg }]}>
            <Feather name={row.icon} size={20} color={TINT[row.tint].fg} />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuLabel}>{row.label}</Text>
            {row.sub ? <Text style={styles.menuSub}>{row.sub}</Text> : null}
          </View>
          <Feather name="chevron-right" size={17} color={mock.textSoft} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: spacing.xxl, gap: 16 },
  loggedOutCard: { alignItems: "center", gap: 4, padding: spacing.lg },
  loggedOutIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  loggedOutTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  loggedOutSub: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.textMute,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 30, color: "#fff" },
  avatarImage: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)" },
  userInfo: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.displayBold, fontSize: 20, color: "#fff" },
  meta: { fontFamily: fonts.body, fontSize: 13, color: "#D9D0EA" },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  roleText: { fontFamily: fonts.mono, fontSize: 9, color: "#E8E0F5", letterSpacing: 0.5 },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  sparkle: { position: "absolute", right: 64, top: 8 },
  completeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  completeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,138,61,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  errorIcon: { backgroundColor: "rgba(239,68,68,0.15)" },
  completeTextWrap: { flex: 1, gap: 2 },
  completeTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: colors.text },
  completeSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute },
  progressRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRingText: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.orange },
  menu: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: mock.cardBorder,
    backgroundColor: mock.cardFill,
    overflow: "hidden",
  },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  menuRowDivider: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  chip: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuText: { flex: 1 },
  menuLabel: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  menuSub: { fontFamily: fonts.body, fontSize: 12, color: mock.textSoft },
  helpCard: {
    padding: 16,
    borderRadius: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,190,120,0.3)",
    backgroundColor: "rgba(255,138,61,0.1)",
  },
  helpHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  helpHeadText: { flex: 1 },
  helpTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: "#fff" },
  helpSub: { fontFamily: fonts.body, fontSize: 12, color: "#D9D0EA" },
  helpEmailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(10,8,18,0.35)",
  },
  helpEmailText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  helpEmailCta: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: "#FFC27A" },
  helpButtons: { flexDirection: "row", gap: 10 },
  helpCallWrap: { flex: 1 },
  helpCall: { height: 44, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  helpWhatsApp: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(37,211,102,0.18)",
    borderWidth: 1,
    borderColor: "rgba(37,211,102,0.6)",
  },
  helpButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: "#fff" },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255,90,110,0.6)",
  },
  logoutText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#FF9AA8" },
  deleteAccount: { alignItems: "center", paddingVertical: 4, paddingBottom: spacing.xl },
  deleteAccountText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute },
});
