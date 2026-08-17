import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { useNotifications } from "@/lib/notifications-context";
import { resolveNotificationHref } from "@/lib/notification-links";
import { CATEGORY_META } from "@/lib/notification-category-meta";
import { captureError } from "@/lib/telemetry";
import { type NotificationCategory, type NotificationItem } from "@/lib/api";
import { colors, fonts, radii, spacing } from "@/theme";

type FilterKey = "ALL" | "BOOKING" | "PAYMENT" | "OFFER";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "BOOKING", label: "Bookings" },
  { key: "PAYMENT", label: "Payments" },
  { key: "OFFER", label: "Offers" },
];

const SHOWS_IMAGE: Partial<Record<NotificationCategory, true>> = { BOOKING: true, OFFER: true };

export default function NotificationsScreen() {
  const { notifications, unreadCount, loading, loadingMore, error, hasMore, refresh, loadMore, markRead, markAllRead } = useNotifications();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterKey>("ALL");

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then(({ status }) => setPermissionDenied(status === "denied"))
      .catch((err) => captureError(err, "notification-permission-check"));
  }, []);

  const filtered = useMemo(
    () => (activeTab === "ALL" ? notifications : notifications.filter((n) => n.category === activeTab)),
    [notifications, activeTab],
  );

  async function handlePress(item: NotificationItem) {
    if (!item.read) markRead(item.id).catch((err) => captureError(err, "notification-mark-read"));
    const href = resolveNotificationHref(item.actionUrl);
    if (href) router.push(href);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
          <View style={styles.headerActions}>
            {unreadCount > 0 ? (
              <Pressable onPress={() => markAllRead()} hitSlop={8}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.back()}
              style={styles.closeButton}
              hitSlop={7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.tabRow}>
          {FILTER_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.pink} style={styles.loader} />
        ) : error && notifications.length === 0 ? (
          // Only block on error before any data has loaded — a later
          // background refresh failure shouldn't blank an already-populated
          // list. Mirrors src/app/(tabs)/bookings.tsx.
          <View style={styles.errorState}>
            <Text style={styles.muted}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => refresh()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (activeTab === "ALL" && hasMore) loadMore();
            }}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.pink} style={styles.footerLoader} /> : null}
            ListHeaderComponent={
              permissionDenied ? (
                <Pressable style={styles.deniedCard} onPress={() => Linking.openSettings()}>
                  <Feather name="bell-off" size={16} color={colors.textDim} />
                  <Text style={styles.deniedText}>
                    Notifications are turned off for GiggiFi. Tap to enable them in Settings.
                  </Text>
                  <Feather name="chevron-right" size={16} color={colors.textMute} />
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <Text style={styles.muted}>
                {activeTab === "ALL" ? "You're all caught up." : `No ${FILTER_TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} notifications.`}
              </Text>
            }
            renderItem={({ item }) => {
              const meta = CATEGORY_META[item.category];
              const showImage = SHOWS_IMAGE[item.category] && item.imageUrl;
              return (
                <Pressable style={[styles.card, !item.read && styles.cardUnread]} onPress={() => handlePress(item)}>
                  {!item.read ? <View style={styles.unreadDot} /> : null}
                  <View style={[styles.iconBadge, { backgroundColor: meta.color + "22" }]}>
                    <Feather name={meta.icon} size={15} color={meta.color} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardText}>{item.body}</Text>
                    <Text style={styles.cardTime}>{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
                  </View>
                  {showImage ? <Image source={{ uri: item.imageUrl! }} style={styles.cardImage} contentFit="cover" /> : null}
                </Pressable>
              );
            }}
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
    marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  markAllText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.pink },
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
  tabRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabActive: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
  },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.textMute },
  tabTextActive: { color: colors.text, fontFamily: fonts.bodySemiBold },
  loader: { marginTop: spacing.xl },
  footerLoader: { marginVertical: spacing.md },
  errorState: { alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  deniedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.sm,
  },
  deniedText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim, lineHeight: 17 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardUnread: { borderColor: colors.lineStrong },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pink, marginTop: 6 },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontFamily: fonts.displayMedium, fontSize: 14.5, color: colors.text },
  cardText: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 18 },
  cardTime: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, marginTop: 2 },
  cardImage: { width: 44, height: 44, borderRadius: radii.sm },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, marginTop: spacing.lg },
});
