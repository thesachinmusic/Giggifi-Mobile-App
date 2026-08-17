import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/lib/auth-context";
import { fetchMyProfile, type BookerProfile } from "@/lib/api";
import { HELPLINE_NUMBER } from "@/lib/constants";
import { colors, fonts, spacing, radii } from "@/theme";

const PROFILE_FIELDS = 5; // fullName, email, city, state, photo (companyName is optional, excluded)

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [bookerProfile, setBookerProfile] = useState<BookerProfile | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      if (user?.role === "ARTIST") return;
      fetchMyProfile()
        .then(({ bookerProfile: result }) => setBookerProfile(result))
        .catch(() => setBookerProfile(null));
    }, [user?.role]),
  );

  async function handleLogout() {
    await logout();
    router.replace("/(auth)/login");
  }

  function handleHelpAndSupport() {
    Alert.alert("Need help?", "Reach the GiggiFi helpline directly.", [
      { text: "Call", onPress: () => Linking.openURL(`tel:${HELPLINE_NUMBER}`) },
      { text: "WhatsApp", onPress: () => Linking.openURL(`https://wa.me/91${HELPLINE_NUMBER}`) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const initial = (user?.name ?? user?.phone ?? "G").trim().charAt(0).toUpperCase();

  const filledCount = bookerProfile
    ? [bookerProfile.fullName, bookerProfile.email, bookerProfile.city, bookerProfile.state, user?.image].filter(Boolean).length
    : 0;
  const completionPct = bookerProfile ? Math.round((filledCount / PROFILE_FIELDS) * 100) : 0;
  const showBookerProfileCard = user?.role !== "ARTIST" && bookerProfile !== undefined;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Profile</Text>

          <GlassCard style={styles.userCard}>
            {user?.image ? (
              <Image source={{ uri: user.image }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={styles.name}>{bookerProfile?.fullName ?? user?.name ?? "GiggiFi user"}</Text>
              {user?.phone ? <Text style={styles.meta}>+{user.phone.replace(/^\+/, "")}</Text> : null}
              {(bookerProfile?.email ?? user?.email) ? <Text style={styles.meta}>{bookerProfile?.email ?? user?.email}</Text> : null}
              {user?.role ? (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{user.role === "ARTIST" ? "ARTIST" : "CLIENT"}</Text>
                </View>
              ) : null}
            </View>
          </GlassCard>

          {showBookerProfileCard ? (
            !bookerProfile ? (
              <Pressable onPress={() => router.push("/booker-profile")}>
                <GlassCard style={styles.completeCard}>
                  <View style={styles.completeIcon}>
                    <Feather name="user-plus" size={18} color={colors.orange} />
                  </View>
                  <View style={styles.completeTextWrap}>
                    <Text style={styles.completeTitle}>Complete your profile</Text>
                    <Text style={styles.completeSub}>Add your details to book artists faster.</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textMute} />
                </GlassCard>
              </Pressable>
            ) : completionPct < 100 ? (
              <Pressable onPress={() => router.push("/booker-profile")}>
                <GlassCard style={styles.completeCard}>
                  <View style={styles.progressRing}>
                    <Text style={styles.progressRingText}>{completionPct}%</Text>
                  </View>
                  <View style={styles.completeTextWrap}>
                    <Text style={styles.completeTitle}>Profile {completionPct}% complete</Text>
                    <Text style={styles.completeSub}>Finish your profile for a smoother booking experience.</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textMute} />
                </GlassCard>
              </Pressable>
            ) : null
          ) : null}

          <View style={styles.menu}>
            {showBookerProfileCard && bookerProfile ? (
              <MenuRow icon="edit-2" label="Edit profile" onPress={() => router.push("/booker-profile")} />
            ) : null}
            <MenuRow icon="calendar" label="My bookings" onPress={() => router.push("/(tabs)/bookings")} />
            <MenuRow icon="bell" label="Notification settings" onPress={() => router.push("/notification-settings")} />
            <MenuRow icon="help-circle" label="Help & support" onPress={handleHelpAndSupport} />
            <MenuRow icon="file-text" label="Terms & Privacy" onPress={() => Linking.openURL("https://giggifi.com/privacy")} />
          </View>

          <Pressable onPress={handleLogout} style={styles.logout}>
            <Feather name="log-out" size={16} color={colors.err} />
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>

          <Pressable onPress={() => router.push("/delete-account")} style={styles.deleteAccount}>
            <Text style={styles.deleteAccountText}>Delete account</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function MenuRow({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.menuRow}>
      <View style={styles.menuLeft}>
        <Feather name={icon} size={17} color={colors.textDim} />
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <Feather name="chevron-right" size={17} color={colors.textMute} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: "#fff",
  },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  userInfo: { flex: 1, gap: 2 },
  name: {
    fontFamily: fonts.displayMedium,
    fontSize: 17,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMute,
  },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  roleText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textDim,
    letterSpacing: 0.5,
  },
  completeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  completeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,138,61,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  completeTextWrap: { flex: 1, gap: 2 },
  completeTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14.5,
    color: colors.text,
  },
  completeSub: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.textMute,
  },
  progressRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRingText: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    color: colors.orange,
  },
  menu: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  menuLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingVertical: 14,
  },
  logoutText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.err,
  },
  deleteAccount: {
    alignItems: "center",
    paddingVertical: 14,
    paddingBottom: spacing.xl,
  },
  deleteAccountText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.textMute,
  },
});
