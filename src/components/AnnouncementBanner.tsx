import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { fetchAnnouncements, type Announcement } from "@/lib/api";
import { resolveNotificationHref } from "@/lib/notification-links";
import { dismissAnnouncement, getDismissedAnnouncementIds } from "@/lib/announcements-storage";
import { gradients, fonts, radii, spacing } from "@/theme";

// Admin-controlled home banner (GET /api/mobile/announcements). That
// endpoint ships in a later phase (admin console) — until then this
// request 404s and the component just renders nothing, same as any other
// empty state. Not to be confused with BannerCarousel, which is the
// static, always-on marketing carousel.
export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAnnouncements(), getDismissedAnnouncementIds()])
      .then(([{ announcements }, dismissedIds]) => {
        if (cancelled) return;
        const next = announcements.find((a) => !dismissedIds.includes(a.id));
        setAnnouncement(next ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement) return null;

  function handlePress() {
    if (!announcement) return;
    const href = resolveNotificationHref(announcement.actionUrl);
    if (href) router.push(href);
  }

  function handleDismiss() {
    if (!announcement) return;
    dismissAnnouncement(announcement.id).catch(() => {});
    setAnnouncement(null);
  }

  return (
    <View style={styles.wrap}>
      <Pressable onPress={handlePress}>
        <LinearGradient colors={gradients.brand} locations={gradients.brandLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>{announcement.title}</Text>
            <Text style={styles.body} numberOfLines={2}>{announcement.body}</Text>
          </View>
          <Pressable hitSlop={10} onPress={handleDismiss} style={styles.dismiss}>
            <Feather name="x" size={14} color="#fff" />
          </Pressable>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  textWrap: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: "#fff" },
  body: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: "rgba(255,255,255,0.85)" },
  dismiss: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
});
