import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { fetchAnnouncements, type Announcement } from "@/lib/api";
import { resolveNotificationHref } from "@/lib/notification-links";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

// Home's admin-controlled announcement banner (giggifi.com/admin/
// announcements) — restored after the "Mix" Home rebuild dropped the old
// AnnouncementBanner + its dead fetchAnnouncements call (see that commit's
// own note). Re-styled to this screen's current compact-strip language
// (same shape as the Reels discovery strip below it) instead of the old
// full-gradient dismissable card. Renders nothing while there's no active
// announcement, same as SeasonalPicksRail/RealEventsRail.
//
// actionUrl is resolved via resolveNotificationHref — the same allowlisted
// relative-path resolver push notifications already use — so an
// announcement can only ever deep-link somewhere this app actually knows
// how to route to. A full https:// URL (not yet a supported convention
// here) falls back to opening in the system browser rather than doing
// nothing silently.
export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const load = useCallback(async () => {
    try {
      const { announcements } = await fetchAnnouncements();
      setAnnouncement(announcements[0] ?? null);
    } catch (err) {
      captureError(err, "home-announcement-fetch");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!announcement) return null;

  function handlePress() {
    const url = announcement!.actionUrl;
    if (!url) return;
    const href = resolveNotificationHref(url);
    if (href) {
      router.push(href);
    } else if (/^https?:\/\//i.test(url)) {
      Linking.openURL(url).catch(() => {});
    }
  }

  return (
    <Pressable style={styles.strip} onPress={handlePress}>
      {announcement.imageUrl ? (
        <Image source={{ uri: announcement.imageUrl }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={styles.iconWrap}>
          <Feather name="radio" size={14} color="#fff" />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{announcement.title}</Text>
        <Text style={styles.sub} numberOfLines={2}>{announcement.body}</Text>
      </View>
      {announcement.actionUrl ? <Feather name="chevron-right" size={18} color={colors.textMute} /> : null}
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
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
  },
  body: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.textMute },
});
