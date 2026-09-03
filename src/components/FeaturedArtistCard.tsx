import { useEffect } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "@/theme";
import { duotoneFor } from "@/lib/palette";
import { captureError } from "@/lib/telemetry";
import { useVideoMute } from "@/lib/video-mute-context";
import type { ArtistSummary } from "@/lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
export const FEATURED_CARD_WIDTH = SCREEN_WIDTH * 0.62;
const FEATURED_CARD_HEIGHT = FEATURED_CARD_WIDTH * (16 / 9);

interface Props {
  artist: ArtistSummary;
  isActive: boolean;
  // Tapping the video opens it full-screen (video-feed.tsx) — reaching the
  // artist's profile is a distinct action (the "View profile" pill below),
  // not the card's default tap target anymore.
  onOpenVideo: () => void;
  onViewProfile: () => void;
}

// Tall, full-bleed autoplay video card for the Home "Featured Artists" rail —
// only the card centered in view actually plays (isActive), everything else
// stays paused so we're not decoding a dozen videos at once.
export function FeaturedArtistCard({ artist, isActive, onOpenVideo, onViewProfile }: Props) {
  const { muted, toggleMuted } = useVideoMute();
  const videoSource = artist.introVideoUrl ?? artist.showreelUrl ?? null;

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  // FlatList keeps several off-screen cards mounted at once, and a real ExoPlayer
  // buffering network video is expensive enough to OOM on weaker Android devices
  // if every card loads its source eagerly — so only the active card ever has
  // real media loaded; everything else stays unloaded until it becomes active.
  useEffect(() => {
    if (!videoSource) return;
    let cancelled = false;
    if (isActive) {
      player.replaceAsync(videoSource).then(() => {
        if (cancelled) return;
        player.muted = muted;
        player.play();
      }).catch((err) => captureError(err, "featured-video-load"));
    } else {
      player.pause();
      player.replaceAsync(null).catch((err) => captureError(err, "featured-video-unload"));
    }
    return () => {
      cancelled = true;
    };
  }, [isActive, videoSource, player]);

  useEffect(() => {
    if (isActive) player.muted = muted;
  }, [muted, isActive, player]);

  const name = artist.stageName ?? "GiggiFi Artist";
  const [c1, c2] = duotoneFor(artist.id);

  return (
    <View style={styles.card}>
      <Pressable style={StyleSheet.absoluteFill} onPress={videoSource ? onOpenVideo : onViewProfile}>
        {videoSource ? (
          // surfaceType="textureView" — see the identical comment in
          // video-feed.tsx's VideoFeedCard: Android's default SurfaceView
          // rendering can swallow taps meant for this Pressable overlay
          // instead of passing them through, even with pointerEvents="none"
          // set. Same overlapping-video-view shape as that card, so it gets
          // the same defensive fix even though no report has come in for
          // this specific card yet.
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            nativeControls={false}
            pointerEvents="none"
            surfaceType="textureView"
          />
        ) : artist.profileImageUrl ? (
          <Image source={{ uri: artist.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={[c1, c2]} style={StyleSheet.absoluteFill} />
        )}

        <LinearGradient
          colors={["transparent", "rgba(12,7,16,0.15)", "rgba(12,7,16,0.92)"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        {videoSource ? (
          <View style={styles.playHint} pointerEvents="none">
            <Feather name="play" size={16} color="#fff" />
          </View>
        ) : null}
      </Pressable>

      {videoSource ? (
        <Pressable
          onPress={toggleMuted}
          style={styles.muteButton}
          hitSlop={9}
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute video" : "Mute video"}
        >
          <Feather name={muted ? "volume-x" : "volume-2"} size={13} color="#fff" />
        </Pressable>
      ) : null}

      {artist.performerType ? (
        <View style={styles.tag} pointerEvents="none">
          <Text style={styles.tagText}>{artist.performerType.toUpperCase()}</Text>
        </View>
      ) : null}

      <View style={styles.info} pointerEvents="box-none">
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <View style={styles.metaRow}>
          {artist.city ? (
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={10} color="rgba(255,255,255,0.7)" />
              <Text style={styles.metaText}>{artist.city}</Text>
            </View>
          ) : null}
          {artist.ratePerEvent ? (
            <Text style={styles.price}>₹{artist.ratePerEvent.toLocaleString("en-IN")}</Text>
          ) : null}
        </View>
        <Pressable style={styles.viewProfile} onPress={onViewProfile} hitSlop={12}>
          <Text style={styles.viewProfileText}>View profile</Text>
          <Feather name="chevron-right" size={12} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: FEATURED_CARD_WIDTH,
    height: FEATURED_CARD_HEIGHT,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    position: "relative",
  },
  // Explicit pixel width/height rather than StyleSheet.absoluteFill —
  // expo-video's contentFit="cover" isn't reliably applied on web (confirmed
  // against the Expo docs), so the video (a replaced element) needs an
  // explicit box to stretch into rather than relying on inset:0 + cover.
  video: { position: "absolute", top: 0, left: 0, width: FEATURED_CARD_WIDTH, height: FEATURED_CARD_HEIGHT },
  muteButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  tag: {
    position: "absolute",
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  tagText: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    color: "#fff",
    letterSpacing: 0.6,
  },
  info: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: "#fff",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: "rgba(255,255,255,0.75)",
  },
  price: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: "#fff",
  },
  playHint: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -18,
    marginLeft: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 4,
  },
  viewProfileText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: "#fff",
    textDecorationLine: "underline",
  },
});
