import { useEffect, useRef } from "react";
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
// tap and the Media tab's thumbnail tap, replacing their previous in-place
// expansion (native controls taking over the hero itself, and the Media tab
// swapping its grid for a player). Native controls, not a custom tap-to-pause
// overlay: video-feed.tsx's VideoFeedCard needed a surfaceType="textureView"
// fix to make a custom overlay's taps register reliably on Android (see its
// own comment) — native controls sidestep that whole class of bug since
// they're rendered by the native player itself, not a separate RN view
// fighting it for touches, matching the already-working InlineVideoPlayer
// pattern this replaces.
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
  }, [uri, player]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />
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
});
