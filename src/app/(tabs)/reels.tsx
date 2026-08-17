import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { RatingBadge } from "@/components/RatingBadge";
import { useSavedArtists } from "@/lib/saved-artists-context";
import { duotoneFor } from "@/lib/palette";
import { fetchArtists, type ArtistSummary } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

type ReelFilter = "all" | "music" | "other";
const MUSIC_TYPES = ["singer", "dj", "live band", "band", "instrumentalist"];

function isMusicAct(artist: ArtistSummary): boolean {
  const type = artist.performerType?.toLowerCase() ?? "";
  return MUSIC_TYPES.some((t) => type.includes(t));
}

// Reels v1 sources content straight from artists' existing intro/showreel videos —
// no separate content model needed. Vendors don't have reels yet.
export default function ReelsScreen() {
  const [reels, setReels] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReelFilter>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [focused, setFocused] = useState(true);
  const listRef = useRef<FlatList<ArtistSummary>>(null);

  // Tab screens stay mounted after their first visit, so switching to
  // another tab wouldn't otherwise stop a playing reel's audio. Combined
  // with activeIndex below, this makes every card's isActive false on blur,
  // which ReelCard's existing effect already treats as "pause and unload".
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    fetchArtists({})
      .then(({ artists }) => setReels(artists.filter((a) => a.introVideoUrl || a.showreelUrl)))
      .catch((err) => captureError(err, "reels-fetch"))
      .finally(() => setLoading(false));
  }, []);

  const filteredReels = useMemo(() => {
    if (filter === "all") return reels;
    return reels.filter((a) => (filter === "music" ? isMusicAct(a) : !isMusicAct(a)));
  }, [reels, filter]);

  function changeFilter(next: ReelFilter) {
    setFilter(next);
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveIndex(viewableItems[0].index);
  }).current;

  return (
    <View style={styles.root} onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}>
      {loading ? (
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator color={colors.pink} />
        </SafeAreaView>
      ) : reels.length === 0 ? (
        <SafeAreaView style={styles.centered}>
          <Feather name="film" size={28} color={colors.textMute} />
          <Text style={styles.emptyText}>No reels yet — artists are still uploading videos.</Text>
        </SafeAreaView>
      ) : (
        <>
          {containerHeight > 0 ? (
            filteredReels.length === 0 ? (
              <SafeAreaView style={styles.centered}>
                <Feather name="film" size={28} color={colors.textMute} />
                <Text style={styles.emptyText}>No {filter} reels right now.</Text>
              </SafeAreaView>
            ) : (
              <FlatList
                ref={listRef}
                data={filteredReels}
                keyExtractor={(item) => item.id}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                snapToInterval={containerHeight}
                decelerationRate="fast"
                viewabilityConfig={viewabilityConfig}
                onViewableItemsChanged={onViewableItemsChanged}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews
                renderItem={({ item, index }) => (
                  <ReelCard artist={item} height={containerHeight} isActive={index === activeIndex && focused} />
                )}
              />
            )
          ) : null}

          <SafeAreaView style={styles.filterBar} edges={["top"]} pointerEvents="box-none">
            <View style={styles.filterRow}>
              <ReelFilterPill label="All" active={filter === "all"} onPress={() => changeFilter("all")} />
              <ReelFilterPill label="🎵 Music" active={filter === "music"} onPress={() => changeFilter("music")} />
              <ReelFilterPill label="✨ Other Acts" active={filter === "other"} onPress={() => changeFilter("other")} />
            </View>
          </SafeAreaView>
        </>
      )}
    </View>
  );
}

function ReelFilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.filterPill, active ? styles.filterPillActive : null]} onPress={onPress}>
      <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function ReelCard({ artist, height, isActive }: { artist: ArtistSummary; height: number; isActive: boolean }) {
  const { isSaved, toggle } = useSavedArtists();
  const [muted, setMuted] = useState(true);
  const videoSource = artist.introVideoUrl ?? artist.showreelUrl ?? null;
  const name = artist.stageName ?? "GiggiFi Artist";
  const [c1, c2] = duotoneFor(artist.id);
  const saved = isSaved(artist.id);

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  // Only the active reel loads real media — the vertical feed keeps neighboring
  // cards mounted, and loading video for all of them at once is what OOM'd the
  // app on device.
  useEffect(() => {
    if (!videoSource) return;
    let cancelled = false;
    if (isActive) {
      player.replaceAsync(videoSource).then(() => {
        if (cancelled) return;
        player.muted = muted;
        player.play();
      }).catch((err) => captureError(err, "reels-video-load"));
    } else {
      player.pause();
      player.replaceAsync(null).catch((err) => captureError(err, "reels-video-unload"));
    }
    return () => {
      cancelled = true;
    };
  }, [isActive, videoSource, player]);

  useEffect(() => {
    if (isActive) player.muted = muted;
  }, [muted, isActive, player]);

  return (
    <View style={[styles.card, { height }]}>
      {videoSource ? (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />
      ) : artist.profileImageUrl ? (
        <Image source={{ uri: artist.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={[c1, c2]} style={StyleSheet.absoluteFill} />
      )}

      <LinearGradient
        colors={["rgba(12,7,16,0.35)", "transparent", "rgba(12,7,16,0.15)", "rgba(12,7,16,0.95)"]}
        locations={[0, 0.2, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <View />
          {videoSource ? (
            <Pressable onPress={() => setMuted((v) => !v)} style={styles.muteButton}>
              <Feather name={muted ? "volume-x" : "volume-2"} size={14} color="#fff" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.info}>
            {artist.performerType ? <Text style={styles.tag}>{artist.performerType.toUpperCase()}</Text> : null}
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <RatingBadge rating={artist.avgRating} size={12} />
            </View>
            {artist.city ? (
              <View style={styles.metaRow}>
                <Feather name="map-pin" size={11} color="rgba(255,255,255,0.75)" />
                <Text style={styles.metaText}>{artist.city}</Text>
              </View>
            ) : null}
            <Pressable style={styles.viewProfile} onPress={() => router.push({ pathname: "/artist/[id]", params: { id: artist.id } })}>
              <Text style={styles.viewProfileText}>View profile & book</Text>
              <Feather name="arrow-right" size={13} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.actionRail}>
            <Pressable style={styles.actionButton} onPress={() => toggle(artist.id)}>
              <Feather name="heart" size={22} color={saved ? colors.pink : "#fff"} />
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => router.push({ pathname: "/artist/[id]", params: { id: artist.id } })}>
              <Feather name="user" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
  emptyText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMute, textAlign: "center" },
  card: { width: "100%", position: "relative", backgroundColor: colors.ink },
  overlay: { flex: 1, justifyContent: "space-between" },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
  },
  filterBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  filterPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  filterPillActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  filterPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: "#fff",
  },
  filterPillTextActive: {
    color: colors.ink,
  },
  muteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  info: { flex: 1, gap: 5 },
  tag: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.orange,
    letterSpacing: 1,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: "#fff",
    flexShrink: 1,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.body, fontSize: 12.5, color: "rgba(255,255,255,0.8)" },
  viewProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  viewProfileText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: "#fff" },
  actionRail: { alignItems: "center", gap: spacing.md },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
});
