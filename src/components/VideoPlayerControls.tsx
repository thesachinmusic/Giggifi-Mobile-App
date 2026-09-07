import { Alert, Pressable, Share, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Slider from "@react-native-community/slider";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, spacing } from "@/theme";
import { captureError } from "@/lib/telemetry";

// Shared visual pieces for every screen a video plays on (FullScreenVideoPlayer,
// the Reels tab, video-feed.tsx) — paired with useVideoPlaybackControls for
// the underlying seek/hold-to-2x logic. Kept as small, composable pieces
// rather than one big wrapper because each host screen's tap-zone layout
// genuinely differs (FullScreenVideoPlayer has separate left/center/right
// seek-and-pause zones; Reels/video-feed cover the whole card with one
// zone) — the shared, non-duplicated part is this UI plus the hook's logic,
// not a single rigid container every screen has to bend around.

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoScrubBar({
  currentTime,
  duration,
  sliderValue,
  onSlidingStart,
  onValueChange,
  onSlidingComplete,
  dark,
}: {
  currentTime: number;
  duration: number;
  sliderValue: number;
  onSlidingStart: () => void;
  onValueChange: (value: number) => void;
  onSlidingComplete: (value: number) => void;
  // Reels/video-feed sit over a photo/video background with no dedicated
  // chrome bar behind them, so their time text needs a stronger shadow to
  // stay legible — FullScreenVideoPlayer's plain black background doesn't.
  dark?: boolean;
}) {
  return (
    <View style={styles.scrubRow}>
      <Text style={[styles.timeText, dark ? styles.timeTextShadow : null]}>{formatTime(currentTime)}</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration > 0 ? duration : 1}
        value={sliderValue}
        minimumTrackTintColor={colors.pink}
        maximumTrackTintColor="rgba(255,255,255,0.3)"
        thumbTintColor="#fff"
        disabled={duration <= 0}
        onSlidingStart={onSlidingStart}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
      />
      <Text style={[styles.timeText, dark ? styles.timeTextShadow : null]}>{formatTime(duration)}</Text>
    </View>
  );
}

export function ShareVideoButton({ shareContent, style }: { shareContent: { message: string; url: string }; style?: ViewStyle }) {
  async function handleShare() {
    try {
      await Share.share({ message: shareContent.message, url: shareContent.url });
    } catch (err) {
      captureError(err, "video-share");
      Alert.alert("Couldn't share", "Please try again.");
    }
  }

  return (
    <Pressable
      onPress={handleShare}
      style={[styles.shareButton, style]}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Share this video"
    >
      <Feather name="share" size={16} color="#fff" />
    </Pressable>
  );
}

export function FastForwardBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.ffBadge} pointerEvents="none">
      <Feather name="fast-forward" size={14} color="#fff" />
      <Text style={styles.ffBadgeText}>2x</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  slider: { flex: 1, height: 32 },
  timeText: { fontFamily: fonts.mono, fontSize: 11, color: "#fff", minWidth: 34, textAlign: "center" },
  timeTextShadow: { textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  shareButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  ffBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -32,
    marginTop: -16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  ffBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: "#fff" },
});
