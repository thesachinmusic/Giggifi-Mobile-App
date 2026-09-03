import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { RatingBadge } from "@/components/RatingBadge";
import { duotoneFor } from "@/lib/palette";
import { useVideoMute } from "@/lib/video-mute-context";
import { takePendingVideoFeed, type VideoFeedItem } from "@/lib/video-feed-handoff";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Full-screen tap-to-expand video viewer shared by Home's Featured/Fresh
// Picks rails and an artist profile's hero video — same swipeable,
// one-active-video-at-a-time pattern as the Reels tab, entered by tapping a
// video instead of it being the default rail behavior. Items come from
// video-feed-handoff.ts (set by the caller right before router.push), not
// route params — keeps route params serializable and avoids re-fetching a
// list the caller already had in memory.
export default function VideoFeedScreen() {
  // Consumed exactly once, here — takePendingVideoFeed() clears itself on
  // read, so capturing both items and the start index from the same call
  // (rather than calling it again for each) matters.
  const [feed] = useState(() => takePendingVideoFeed() ?? { items: [] as VideoFeedItem[], startIndex: 0 });
  const items = feed.items;
  const [activeIndex, setActiveIndex] = useState(feed.startIndex);
  const [focused, setFocused] = useState(true);
  const listRef = useRef<FlatList<VideoFeedItem>>(null);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 65 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveIndex(viewableItems[0].index);
  }).current;

  if (items.length === 0) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.emptyState} edges={["top", "bottom"]}>
          <Text style={styles.emptyText}>Nothing to show here.</Text>
          <Pressable style={styles.closeButtonInline} onPress={() => router.back()}>
            <Text style={styles.closeButtonInlineText}>Close</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        initialScrollIndex={feed.startIndex}
        getItemLayout={(_, index) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * index, index })}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        renderItem={({ item, index }) => (
          <VideoFeedCard item={item} isActive={index === activeIndex && focused} />
        )}
      />

      <SafeAreaView style={styles.topBar} edges={["top"]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Feather name="x" size={20} color="#fff" />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function VideoFeedCard({ item, isActive }: { item: VideoFeedItem; isActive: boolean }) {
  const { muted, toggleMuted } = useVideoMute();
  const [paused, setPaused] = useState(false);
  const [c1, c2] = duotoneFor(item.id);
  const name = item.stageName ?? "GiggiFi Artist";

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    let cancelled = false;
    if (isActive) {
      player.replaceAsync(item.videoUrl).then(() => {
        if (cancelled) return;
        player.muted = muted;
        if (!paused) player.play();
      }).catch((err) => captureError(err, "video-feed-load"));
    } else {
      player.pause();
      player.replaceAsync(null).catch((err) => captureError(err, "video-feed-unload"));
    }
    return () => {
      cancelled = true;
    };
    // paused deliberately excluded — this effect only handles (un)loading the
    // source on activation, not react to play/pause taps (see effect below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, item.videoUrl, player]);

  useEffect(() => {
    if (isActive) player.muted = muted;
  }, [muted, isActive, player]);

  // Reset to playing whenever a card becomes active again (e.g. swiping
  // back to one you'd previously paused shouldn't stay frozen).
  useEffect(() => {
    if (isActive) setPaused(false);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    if (paused) player.pause();
    else player.play();
  }, [paused, isActive, player]);

  return (
    <View style={styles.card}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaused((v) => !v)}>
        {/* surfaceType="textureView": Android defaults VideoView to SurfaceView,
            which composites via a separate native window outside RN's own
            view hierarchy — pointerEvents="none" on it doesn't reliably stop
            it from swallowing/misrouting taps meant for the Pressable
            overlaying it. expo-video's own docs name this exact case
            ("overlapping video views") as the reason to switch to
            textureView, which participates in normal view compositing. This
            is why tapping this card silently failed to toggle play/pause on
            real Android devices despite the JS-side toggle logic being
            correct. */}
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
          surfaceType="textureView"
        />
        {paused ? (
          <View style={styles.pauseOverlay} pointerEvents="none">
            <View style={styles.pauseIconWrap}>
              <Feather name="play" size={28} color="#fff" />
            </View>
          </View>
        ) : null}
      </Pressable>

      <LinearGradient
        colors={["rgba(12,7,16,0.35)", "transparent", "rgba(12,7,16,0.15)", "rgba(12,7,16,0.95)"]}
        locations={[0, 0.2, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.overlay} edges={["top", "bottom", "left", "right"]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View />
          <Pressable
            onPress={toggleMuted}
            style={styles.muteButton}
            hitSlop={9}
            accessibilityRole="button"
            accessibilityLabel={muted ? "Unmute video" : "Mute video"}
          >
            <Feather name={muted ? "volume-x" : "volume-2"} size={14} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.info}>
            {item.performerType ? <Text style={styles.tag}>{item.performerType.toUpperCase()}</Text> : null}
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <RatingBadge rating={item.avgRating} size={12} />
            </View>
            {item.city ? (
              <View style={styles.metaRow}>
                <Feather name="map-pin" size={11} color="rgba(255,255,255,0.75)" />
                <Text style={styles.metaText}>{item.city}</Text>
              </View>
            ) : null}
            <Pressable
              style={styles.viewProfile}
              onPress={() => router.push({ pathname: "/artist/[id]", params: { id: item.id } })}
            >
              <Text style={styles.viewProfileText}>View profile & book</Text>
              <Feather name="arrow-right" size={13} color="#fff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {!item.videoUrl ? (
        <LinearGradient colors={[c1, c2]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  list: { flex: 1 },
  card: { width: "100%", height: SCREEN_HEIGHT, position: "relative", backgroundColor: colors.ink },
  overlay: { flex: 1, justifyContent: "space-between" },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  info: { gap: 5 },
  tag: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.orange, letterSpacing: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontFamily: fonts.display, fontSize: 22, color: "#fff", flexShrink: 1 },
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
  pauseOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  pauseIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: { position: "absolute", top: 0, left: 0, right: 0 },
  closeButton: {
    marginTop: spacing.sm,
    marginLeft: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute },
  closeButtonInline: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  closeButtonInlineText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
});
