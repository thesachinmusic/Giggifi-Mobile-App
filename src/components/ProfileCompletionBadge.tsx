import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { isProfileComplete } from "@/lib/profile-completion";
import { colors, fonts, radii, spacing } from "@/theme";

// Home's soft, persistent profile-completion nudge — same compact-strip
// visual language as the reels discovery strip and AnnouncementBanner
// right above it. Renders nothing while logged out (nothing to complete
// yet — that's what /verify is for) or once every soft field is filled.
// Never blocks anything; tapping it just opens the edit screen, where
// every field stays individually optional.
export function ProfileCompletionBadge() {
  const { user } = useAuth();

  if (!user || isProfileComplete(user)) return null;

  return (
    <Pressable style={styles.strip} onPress={() => router.push("/edit-profile")}>
      <View style={styles.iconWrap}>
        <Feather name="user" size={14} color="#fff" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.sub}>For a better, more personal experience</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMute} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMute },
});
