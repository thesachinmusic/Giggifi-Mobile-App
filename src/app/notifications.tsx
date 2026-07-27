import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { fetchNotifications, markNotificationRead, type NotificationItem } from "@/lib/api";
import { colors, fonts, radii, spacing } from "@/theme";

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { notifications: results } = await fetchNotifications();
      setNotifications(results);
    } catch {
      // Leave the list empty on failure — nothing more actionable to show here.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePress(item: NotificationItem) {
    if (!item.read) {
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      markNotificationRead(item.id).catch(() => {});
    }
    if (item.actionUrl) router.push(item.actionUrl as never);
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Feather name="x" size={18} color={colors.text} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.pink} style={styles.loader} />
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.muted}>You're all caught up.</Text>}
            renderItem={({ item }) => (
              <Pressable style={[styles.card, !item.read && styles.cardUnread]} onPress={() => handlePress(item)}>
                {!item.read ? <View style={styles.unreadDot} /> : null}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardText}>{item.body}</Text>
                  <Text style={styles.cardTime}>{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
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
  loader: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardUnread: { borderColor: colors.lineStrong },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pink, marginTop: 6 },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontFamily: fonts.displayMedium, fontSize: 14.5, color: colors.text },
  cardText: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 18 },
  cardTime: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, marginTop: 2 },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, marginTop: spacing.lg },
});
