import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { fetchRealEvents, type RealEvent } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, fonts, radii, spacing } from "@/theme";

const TILE_WIDTH = 130;

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm"];
function isVideoUrl(url: string) {
  const lower = url.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.includes(ext));
}

// No photo/video upload exists anywhere in the app yet — the only review
// flow (booking/[id].tsx's ReviewFormCard) is rating + text comment only,
// no media picker. Honest placeholder rather than a fake destination:
// swap for real navigation once upload support is built.
function handleUploadTilePress() {
  Alert.alert("Coming soon", "Sharing photos & videos from your events is on its way.");
}

// Home's "From Real Events" — admin-approved reviews with real uploaded
// media only (see app/api/mobile/real-events/route.ts). Renders nothing
// while empty, same pattern as SeasonalPicksRail.
export function RealEventsRail() {
  const [events, setEvents] = useState<RealEvent[]>([]);

  const load = useCallback(async () => {
    try {
      const { events: results } = await fetchRealEvents();
      setEvents(results);
    } catch (err) {
      captureError(err, "home-real-events-fetch");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (events.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <SectionHeader title="From real events" sub="Real moments from real bookings" />
      <FlatList
        data={events}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.row}
        ListHeaderComponent={
          <Pressable style={styles.uploadTile} onPress={handleUploadTilePress}>
            <View style={styles.uploadIcon}>
              <Feather name="camera" size={20} color={colors.purple} />
            </View>
            <Text style={styles.uploadText}>Share your{"\n"}moments & review</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <View style={styles.tile}>
            <Image source={{ uri: item.mediaUrls[0] }} style={styles.tileImage} contentFit="cover" />
            {isVideoUrl(item.mediaUrls[0]) ? (
              <View style={styles.playBadge}>
                <Feather name="play" size={11} color="#fff" />
              </View>
            ) : null}
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.tileOverlay}>
              <View style={styles.ratingRow}>
                <Feather name="star" size={10} color={colors.gold} />
                <Text style={styles.ratingText}>{item.rating}</Text>
              </View>
              <Text style={styles.tileArtist} numberOfLines={1}>{item.artistName}</Text>
              <Text style={styles.tileMeta} numberOfLines={1}>{item.eventType} · {item.eventCity}</Text>
            </LinearGradient>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  uploadTile: {
    width: TILE_WIDTH,
    height: TILE_WIDTH * 1.3,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(168,85,247,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    color: colors.text,
    textAlign: "center",
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_WIDTH * 1.3,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surface2,
  },
  tileImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  playBadge: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    gap: 2,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 1 },
  ratingText: { fontFamily: fonts.bodySemiBold, fontSize: 10.5, color: "#fff" },
  tileArtist: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: "#fff" },
  tileMeta: { fontFamily: fonts.body, fontSize: 9.5, color: "rgba(255,255,255,0.75)" },
});
