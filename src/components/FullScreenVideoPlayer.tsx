import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import Slider from "@react-native-community/slider";
import { Feather } from "@expo/vector-icons";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, spacing } from "@/theme";

interface FullScreenVideoPlayerProps {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}

const SEEK_SECONDS = 10;
// How long a run of same-side taps keeps accumulating (10 -> 20 -> 30s)
// before the next tap starts a fresh run — matches YouTube's own timing.
const SEEK_TAP_WINDOW_MS = 900;

// The one full-screen video player used everywhere a single video is
// tapped open — the artist hero, the Media tab's thumbnails, and any future
// site. Deliberately NOT a <Modal>: two rounds of <Modal>-based fixes
// (nativeControls, then custom controls) never became reliably tappable on
// a real Android device, and a `<Modal>` renders through its own separate
// native window outside RN's normal view hierarchy — exactly the class of
// problem surfaceType="textureView" exists to work around elsewhere in this
// app. This is a plain state-driven overlay living in the same component
// tree instead, so it's real RN views all the way down.
//
// Because there's no Modal, this only ever fills its own immediate parent's
// box (RN position:absolute is relative to the nearest ancestor, and every
// RN View is implicitly a position context) — so the CALLER must render
// this as a direct child of the screen's own top-level, full-screen
// container (e.g. GradientBackground's children), not nested inside a
// small subcomponent like a hero image or a tab's content view, or it will
// only cover that smaller box instead of the whole screen.
export function FullScreenVideoPlayer({ visible, uri, onClose }: FullScreenVideoPlayerProps) {
  if (!visible || !uri) return null;
  return <FullScreenVideoPlayerContent uri={uri} onClose={onClose} />;
}

// Split out so the player (and its native resources) only exists while the
// overlay is actually open — mounted fresh each time, not kept loaded-but-
// hidden in the background.
function FullScreenVideoPlayerContent({ uri, onClose }: { uri: string; onClose: () => void }) {
  const mountedRef = useRef(true);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekAccumRef = useRef<{ side: "left" | "right" | null; total: number; timeoutId: ReturnType<typeof setTimeout> | null }>({
    side: null,
    total: 0,
    timeoutId: null,
  });
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (seekAccumRef.current.timeoutId) clearTimeout(seekAccumRef.current.timeoutId);
    };
  }, []);

  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  // Shown centered over the video: persists while genuinely paused (tap to
  // resume), otherwise flashes briefly on resume/seek then fades — same
  // "icon = the action available" convention used everywhere else in this
  // app (video-feed.tsx, FeaturedArtistCard).
  const [flashIcon, setFlashIcon] = useState<"play" | "pause" | null>(null);

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false;
    instance.muted = false;
    // 0 (the default) disables the timeUpdate event entirely — needed for
    // the scrub bar to track playback position.
    instance.timeUpdateEventInterval = 0.25;
  });

  useEffect(() => {
    let cancelled = false;
    player.replaceAsync(uri).then(() => {
      if (cancelled || !mountedRef.current) return;
      player.play();
    }).catch((err) => captureError(err, "fullscreen-video-load"));
    // Cleanup guarded with try/catch — same release race as artist/[id].tsx's
    // ArtistHero useFocusEffect cleanup: useVideoPlayer's own
    // release-on-unmount effect can fire before this one on a real unmount,
    // so pause() here can hit an already-released SharedObject and throw
    // synchronously. Expected and harmless.
    return () => {
      cancelled = true;
      try {
        player.pause();
      } catch {
        // Expected on a real unmount — see comment above.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, player]);

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  const { currentTime } = useEvent(player, "timeUpdate", {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const duration = player.duration || 0;

  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const sliderValue = dragging ? dragValue : currentTime;

  const [seekIndicator, setSeekIndicator] = useState<{ side: "left" | "right"; total: number } | null>(null);

  function flashCenterIcon(name: "play" | "pause", autoHide: boolean) {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlashIcon(name);
    if (autoHide) {
      flashTimeoutRef.current = setTimeout(() => setFlashIcon(null), 500);
    }
  }

  function handleCenterTap() {
    const next = !paused;
    setPaused(next);
    // Pausing: show "tap to play" and leave it up. Resuming: confirm with a
    // brief pause-icon flash, same as tapping play on any standard player.
    flashCenterIcon(next ? "play" : "pause", !next);
  }

  function handleSeekTap(side: "left" | "right") {
    const delta = side === "right" ? SEEK_SECONDS : -SEEK_SECONDS;
    player.seekBy(delta);
    const accum = seekAccumRef.current;
    const continuingRun = accum.side === side && accum.timeoutId !== null;
    accum.total = continuingRun ? accum.total + SEEK_SECONDS : SEEK_SECONDS;
    accum.side = side;
    if (accum.timeoutId) clearTimeout(accum.timeoutId);
    accum.timeoutId = setTimeout(() => {
      seekAccumRef.current = { side: null, total: 0, timeoutId: null };
      setSeekIndicator(null);
    }, SEEK_TAP_WINDOW_MS);
    setSeekIndicator({ side, total: accum.total });
  }

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
        pointerEvents="none"
        surfaceType="textureView"
      />

      {/* Left/center/right tap zones, rendered first — every control below
          (mute, scrub bar, back button) is a later sibling and so wins its
          own bounded area on top of these, the same "topmost sibling
          claims the tap" pattern already proven in FeaturedArtistCard. */}
      <View style={styles.tapZoneRow} pointerEvents="box-none">
        <Pressable style={styles.tapZone} onPress={() => handleSeekTap("left")} accessibilityRole="button" accessibilityLabel="Seek back 10 seconds" />
        <Pressable style={styles.tapZone} onPress={handleCenterTap} accessibilityRole="button" accessibilityLabel={paused ? "Play" : "Pause"} />
        <Pressable style={styles.tapZone} onPress={() => handleSeekTap("right")} accessibilityRole="button" accessibilityLabel="Seek forward 10 seconds" />
      </View>

      {seekIndicator ? (
        <View
          style={[styles.seekIndicator, seekIndicator.side === "left" ? styles.seekIndicatorLeft : styles.seekIndicatorRight]}
          pointerEvents="none"
        >
          <Feather name={seekIndicator.side === "left" ? "rotate-ccw" : "rotate-cw"} size={20} color="#fff" />
          <Text style={styles.seekIndicatorText}>{seekIndicator.side === "left" ? "-" : "+"}{seekIndicator.total}s</Text>
        </View>
      ) : null}

      {/* Mute sits just above the center play/pause zone, not in a corner —
          Sachin flagged corner controls as unreliable to reach one-handed
          on a real device; this keeps it an easy thumb-reach near the
          middle, Instagram-style. */}
      <View style={styles.centerStack} pointerEvents="box-none">
        <Pressable
          onPress={() => setMuted((v) => !v)}
          style={styles.muteButton}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute video" : "Mute video"}
        >
          <Feather name={muted ? "volume-x" : "volume-2"} size={18} color="#fff" />
        </Pressable>
        {flashIcon ? (
          <View style={styles.flashIconWrap} pointerEvents="none">
            <Feather name={flashIcon} size={30} color="#fff" />
          </View>
        ) : (
          <View style={styles.flashIconSpacer} />
        )}
      </View>

      <SafeAreaView style={styles.chrome} edges={["top", "bottom", "left", "right"]} pointerEvents="box-none">
        <Pressable
          onPress={onClose}
          style={styles.backButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close video"
        >
          <Feather name="chevron-left" size={22} color="#fff" />
        </Pressable>

        <View style={styles.seekBarRow} pointerEvents="box-none">
          <Text style={styles.timeText}>{formatTime(sliderValue)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration > 0 ? duration : 1}
            value={sliderValue}
            minimumTrackTintColor={colors.pink}
            maximumTrackTintColor="rgba(255,255,255,0.3)"
            thumbTintColor="#fff"
            disabled={duration <= 0}
            onSlidingStart={() => {
              setDragging(true);
              setDragValue(currentTime);
            }}
            onValueChange={setDragValue}
            onSlidingComplete={(value) => {
              player.currentTime = value;
              setDragging(false);
            }}
          />
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", zIndex: 999, elevation: 999 },
  video: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  tapZoneRow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" },
  tapZone: { flex: 1 },
  seekIndicator: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  seekIndicatorLeft: { left: "12%" },
  seekIndicatorRight: { right: "12%" },
  seekIndicatorText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#fff" },
  centerStack: { position: "absolute", top: "50%", left: 0, right: 0, alignItems: "center", gap: 14, transform: [{ translateY: -55 }] },
  muteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  flashIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  flashIconSpacer: { width: 56, height: 56 },
  chrome: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "space-between" },
  backButton: {
    marginTop: spacing.sm,
    marginLeft: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  seekBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  slider: { flex: 1, height: 32 },
  timeText: { fontFamily: fonts.mono, fontSize: 11, color: "#fff", minWidth: 34, textAlign: "center" },
});
