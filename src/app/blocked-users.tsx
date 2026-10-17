import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GlassCard } from "@/components/GlassCard";
import { fetchBlockedUsers, unblockUser, type BlockedUser } from "@/lib/api";
import { BLOCKED_USERS_EMPTY, BLOCKED_USERS_NOTE, UNBLOCK_ERROR_TEXT } from "@/lib/block-copy";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, spacing } from "@/theme";

export default function BlockedUsersScreen() {
  const [people, setPeople] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    fetchBlockedUsers()
      .then(({ blocks }) => setPeople(blocks))
      .catch((err) => {
        captureError(err, "blocked-users-fetch");
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  function unblock(userId: string) {
    unblockUser(userId)
      .then(() => setPeople((list) => list.filter((p) => p.userId !== userId)))
      .catch((err) => {
        captureError(err, "unblock-user");
        Alert.alert(UNBLOCK_ERROR_TEXT);
      });
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {loading ? null : error ? (
          <View style={styles.centered}>
            <Text style={styles.muted}>Couldn&apos;t load your blocked users — check your connection.</Text>
            <Pressable style={styles.button} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={people}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={styles.list}
            ListHeaderComponent={<Text style={styles.note}>{BLOCKED_USERS_NOTE}</Text>}
            ListEmptyComponent={<Text style={styles.muted}>{BLOCKED_USERS_EMPTY}</Text>}
            renderItem={({ item }) => (
              <GlassCard style={styles.row}>
                <Text style={styles.name}>{item.name}</Text>
                <Pressable style={styles.button} onPress={() => unblock(item.userId)} accessibilityRole="button" accessibilityLabel={`Unblock ${item.name}`}>
                  <Text style={styles.buttonText}>Unblock</Text>
                </Pressable>
              </GlassCard>
            )}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.sm },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
  note: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim, marginBottom: spacing.md },
  muted: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMute, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  name: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: colors.text },
  button: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  buttonText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
});
