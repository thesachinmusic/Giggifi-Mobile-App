import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { captureError } from "@/lib/telemetry";
import { fonts, spacing } from "@/theme";

interface VideoModalProps {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}

// Shared full-screen video popup — used by the artist profile's hero video
// tap and the Media tab's thumbnail tap. Custom play/pause + mute controls,
// NOT expo-video's nativeControls — that was the original design here and
// it shipped but failed real-device testing twice (tap-to-open unreliable,
// and once open, native play/pause/mute didn't respond at all). Native
// player chrome rendering/responding reliably on Android has been the
// recurring problem in this app — it's the exact reason
// surfaceType="textureView" had to be added to every ambient video view
// elsewhere (video-feed.tsx, FeaturedArtistCard, the hero's own background
// video): Android's default SurfaceView compositing doesn't reliably
// cooperate with touch/overlay handling. Custom controls + textureView here
// too is the same proven pattern already working on those screens, not a
// different, untested mechanism.
export function VideoModal({ visible, uri, onClose }: VideoModalProps) {
  if (!visible || !uri) return null;
  return <VideoModalContent uri={uri} onClose={onClose} />;
}

// Split out so the player (and its native resources) only exists while the
// modal is actually open — mounted fresh each time `visible`/`uri` go true,
// not kept loaded-but-hidden in the background.
function VideoModalContent({ uri, onClose }: { uri: string; onClose: () => void }) {
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false;
    instance.muted = false;
  });

  useEffect(() => {
    let cancelled = false;
    player.replaceAsync(uri).then(() => {
      if (cancelled || !mountedRef.current) return;
      player.play();
    }).catch((err) => captureError(err, "video-modal-load"));
    // Cleanup guarded with try/catch — same release race as artist/[id].tsx's
    // ArtistHero useFocusEffect cleanup: useVideoPlayer's own
    // release-on-unmount effect can fire before this one on a real unmount
    // (React runs cleanups in declaration order, and that one's registered
    // first, inside the hook), so pause() here can hit an already-released
    // SharedObject and throw synchronously. Expected and harmless — see that
    // file's full comment for the confirmed root cause this mirrors.
    return () => {
      cancelled = true;
      try {
        player.pause();
      } catch {
        // Expected on a real unmount — see comment above.
      }
    };
    // paused/muted deliberately excluded — this effect only handles loading
    // the source once, not reacting to the toggle taps below (see the two
    // dedicated effects), same split video-feed.tsx's VideoFeedCard uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, player]);

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaused((v) => !v)}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
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

        <SafeAreaView style={StyleSheet.absoluteFill} edges={["top", "left", "right"]} pointerEvents="box-none">
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close video"
          >
            <Feather name="chevron-left" size={18} color="#fff" />
            <Text style={styles.closeButtonText}>Back</Text>
          </Pressable>

          <Pressable
            onPress={() => setMuted((v) => !v)}
            style={styles.muteButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={muted ? "Unmute video" : "Mute video"}
          >
            <Feather name={muted ? "volume-x" : "volume-2"} size={15} color="#fff" />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000" },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 8,
    paddingRight: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  closeButtonText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: "#fff" },
  muteButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
