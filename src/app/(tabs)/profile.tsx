import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/lib/auth-context";
import { colors, fonts, spacing, radii } from "@/theme";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/(auth)/login");
  }

  const initial = (user?.name ?? user?.phone ?? "G").trim().charAt(0).toUpperCase();

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.title}>Profile</Text>

        <GlassCard style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.name}>{user?.name ?? "GiggiFi user"}</Text>
            {user?.phone ? <Text style={styles.meta}>+{user.phone.replace(/^\+/, "")}</Text> : null}
            {user?.email ? <Text style={styles.meta}>{user.email}</Text> : null}
            {user?.role ? (
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{user.role === "ARTIST" ? "ARTIST" : "CLIENT"}</Text>
              </View>
            ) : null}
          </View>
        </GlassCard>

        <View style={styles.menu}>
          <MenuRow icon="calendar" label="My bookings" onPress={() => router.push("/(tabs)/bookings")} />
          <MenuRow icon="help-circle" label="Help & support" onPress={() => {}} />
          <MenuRow icon="file-text" label="Terms & Privacy" onPress={() => {}} />
        </View>

        <Pressable onPress={handleLogout} style={styles.logout}>
          <Feather name="log-out" size={16} color={colors.err} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
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
  safe: { flex: 1, paddingHorizontal: spacing.lg },
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
});
