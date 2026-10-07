import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { MomentArt } from "@/components/quick-moments/MomentArt";
import { duotoneFor } from "@/lib/palette";
import type { QuickMomentDiscoverItem, QuickMomentDiscoverReel, QuickMomentDuration, QuickMomentFormat } from "@/lib/api";
import {
  availabilityLabel,
  formatINR,
  MOMENT_IMAGES,
  nearLabel,
  QUICK_MOMENT_FORMATS,
} from "@/lib/quick-moments";
import { colors, fonts, gradients, radii, spacing } from "@/theme";

// ── Moment picker ─────────────────────────────────────────────────────────────

const MOMENT_BACKGROUND: Record<QuickMomentFormat, readonly [string, string]> = {
  BIRTHDAY_SURPRISE: [colors.purple, colors.pink],
  ANNIVERSARY_SERENADE: [colors.magenta, colors.orange],
  JUST_BECAUSE: [colors.ink3, colors.purple],
};

export function MomentCards({ selected, onSelect }: { selected: QuickMomentFormat | null; onSelect: (f: QuickMomentFormat) => void }) {
  return (
    <View style={s.momentRow}>
      {QUICK_MOMENT_FORMATS.map((f) => {
        const active = selected === f.key;
        const photo = MOMENT_IMAGES[f.key];
        return (
          <Pressable
            key={f.key}
            onPress={() => onSelect(f.key)}
            style={[s.momentOuter, active && s.momentGlow]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={f.label}
          >
            <LinearGradient
              colors={active ? gradients.brand : [colors.line, colors.line]}
              locations={active ? gradients.brandLocations : undefined}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.momentBorder}
            >
              <View style={s.momentInner}>
                {photo ? (
                  <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <>
                    <LinearGradient colors={MOMENT_BACKGROUND[f.key]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                    <View style={s.artWrap} pointerEvents="none">
                      <MomentArt format={f.key} />
                    </View>
                  </>
                )}
                <LinearGradient
                  colors={["transparent", colors.ink + "99", colors.ink + "F2"]}
                  locations={[0.2, 0.62, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={s.momentText}>
                  <Text style={s.momentLabel} numberOfLines={2}>{f.label}</Text>
                </View>
                {active ? (
                  <View style={s.momentCheck}>
                    <Feather name="check" size={12} color={colors.text} />
                  </View>
                ) : null}
              </View>
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Duration ──────────────────────────────────────────────────────────────────

export function DurationCards({
  durations,
  selected,
  onSelect,
}: {
  durations: { minutes: QuickMomentDuration; priceINR: number }[];
  selected: QuickMomentDuration;
  onSelect: (m: QuickMomentDuration) => void;
}) {
  return (
    <View style={s.durationRow}>
      {durations.map((d) => {
        const active = selected === d.minutes;
        return (
          <Pressable
            key={d.minutes}
            onPress={() => onSelect(d.minutes)}
            style={[s.durationCard, active && s.durationCardActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[s.durationMinutes, active && s.durationMinutesActive]}>{d.minutes} min</Text>
            <Text style={s.durationPrice}>{formatINR(d.priceINR)} + travel</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Artist tiles ──────────────────────────────────────────────────────────────

function Avatar({ item, style }: { item: Pick<QuickMomentDiscoverItem, "artistId" | "displayName" | "profileImageUrl">; style: object }) {
  const [c1, c2] = duotoneFor(item.artistId);
  if (item.profileImageUrl) return <Image source={{ uri: item.profileImageUrl }} style={style} contentFit="cover" />;
  return (
    <LinearGradient colors={[c1, c2]} style={[style, s.avatarFallback]}>
      <Text style={s.avatarInitial}>{item.displayName.trim().charAt(0).toUpperCase()}</Text>
    </LinearGradient>
  );
}

function AvailabilityLine({ item }: { item: QuickMomentDiscoverItem }) {
  return (
    <View style={s.availRow}>
      <View style={[s.dot, item.online ? s.dotOnline : s.dotOffline]} />
      <Text style={[s.availText, item.online && s.availTextOnline]} numberOfLines={1}>{availabilityLabel(item)}</Text>
    </View>
  );
}

export function ArtistTile({ item, onPress }: { item: QuickMomentDiscoverItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.tile, !item.online && s.tileOffline]} accessibilityRole="button" accessibilityLabel={item.displayName}>
      <Avatar item={item} style={s.tileImage} />
      <View style={s.tileBody}>
        <Text style={s.tileName} numberOfLines={1}>{item.displayName}</Text>
        <Text style={s.tileCategory} numberOfLines={1}>{(item.performerType ?? item.category).toUpperCase()}</Text>
        <View style={s.nearRow}>
          <Feather name="map-pin" size={10} color={colors.textMute} />
          <Text style={s.nearText}>{nearLabel(item)}</Text>
        </View>
        <AvailabilityLine item={item} />
      </View>
    </Pressable>
  );
}

export function FeaturedCard({ item, onPress }: { item: QuickMomentDiscoverItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.featured} accessibilityRole="button" accessibilityLabel={`Featured: ${item.displayName}`}>
      <Avatar item={item} style={s.fillAll} />
      <LinearGradient colors={["transparent", colors.ink + "55", colors.ink + "F2"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={s.featuredBadge}>
        <Text style={s.featuredBadgeText}>FEATURED</Text>
      </View>
      <View style={s.featuredInfo}>
        <Text style={s.featuredName} numberOfLines={1}>{item.displayName}</Text>
        <Text style={s.featuredMeta} numberOfLines={1}>{(item.performerType ?? item.category).toUpperCase()}</Text>
        <View style={s.featuredBottom}>
          <View style={{ flex: 1 }}>
            <View style={s.nearRow}>
              <Feather name="map-pin" size={11} color={colors.textDim} />
              <Text style={s.featuredNear}>{nearLabel(item)}</Text>
            </View>
            <AvailabilityLine item={item} />
          </View>
          <View style={s.bookPill}>
            <Text style={s.bookPillText}>Book</Text>
            <Feather name="chevron-right" size={14} color={colors.text} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function ReelTile({ reel, fallbackImage, onPress }: { reel: QuickMomentDiscoverReel; fallbackImage: string | null; onPress: () => void }) {
  const [c1, c2] = duotoneFor(reel.artistId);
  const poster = reel.thumbnailUrl ?? fallbackImage;
  return (
    <Pressable onPress={onPress} style={s.reel} accessibilityRole="button" accessibilityLabel={`Play reel by ${reel.displayName}`}>
      {poster ? (
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={[c1, c2]} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient colors={["transparent", colors.ink + "CC"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={s.reelPlay}>
        <Feather name="play" size={16} color={colors.text} />
      </View>
      <Text style={s.reelName} numberOfLines={1}>{reel.displayName}</Text>
    </Pressable>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

export function RowTitle({ title }: { title: string }) {
  return <Text style={s.rowTitle}>{title}</Text>;
}

export function LabelCaps({ text }: { text: string }) {
  return <Text style={s.labelCaps}>{text}</Text>;
}

const MOMENT_HEIGHT = 150;
const TILE_WIDTH = 150;

const s = StyleSheet.create({
  momentRow: { flexDirection: "row", gap: spacing.sm },
  momentOuter: { flex: 1 },
  momentGlow: {
    shadowColor: colors.pink,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  momentBorder: { borderRadius: radii.lg, padding: 2 },
  momentInner: { height: MOMENT_HEIGHT, borderRadius: radii.lg - 2, overflow: "hidden", backgroundColor: colors.surface },
  artWrap: { position: "absolute", right: -14, top: 8, transform: [{ scale: 0.8 }] },
  momentText: { position: "absolute", left: spacing.sm, right: spacing.sm, bottom: spacing.sm },
  momentLabel: { fontFamily: fonts.display, fontSize: 14, lineHeight: 17, color: colors.text },
  momentCheck: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  durationRow: { flexDirection: "row", gap: spacing.sm },
  durationCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  durationCardActive: { borderColor: colors.pink, backgroundColor: colors.pink + "14" },
  durationMinutes: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  durationMinutesActive: { color: colors.text },
  durationPrice: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.textDim },

  fillAll: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: fonts.display, fontSize: 40, color: colors.textMute },
  availRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotOnline: { backgroundColor: colors.ok },
  dotOffline: { backgroundColor: colors.textMute },
  availText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMute, flexShrink: 1 },
  availTextOnline: { color: colors.ok },
  nearRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  nearText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMute },

  tile: {
    width: TILE_WIDTH,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tileOffline: { opacity: 0.8 },
  tileImage: { width: TILE_WIDTH, height: TILE_WIDTH },
  tileBody: { padding: spacing.sm, gap: 3 },
  tileName: { fontFamily: fonts.displayMedium, fontSize: 14, color: colors.text },
  tileCategory: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.5, color: colors.textMute },

  featured: {
    height: 230,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    position: "relative",
  },
  featuredBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.orange,
  },
  featuredBadgeText: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.8, color: colors.ink },
  featuredInfo: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md, gap: 3 },
  featuredName: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  featuredMeta: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.6, color: colors.textDim },
  featuredBottom: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: 4 },
  featuredNear: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  bookPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.pink,
  },
  bookPillText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },

  reel: {
    width: 110,
    height: 170,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    position: "relative",
  },
  reelPlay: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink + "99",
    alignItems: "center",
    justifyContent: "center",
  },
  reelName: { position: "absolute", left: spacing.xs, right: spacing.xs, bottom: spacing.xs, fontFamily: fonts.bodySemiBold, fontSize: 11.5, color: colors.text },

  rowTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
  labelCaps: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.6 },
});
