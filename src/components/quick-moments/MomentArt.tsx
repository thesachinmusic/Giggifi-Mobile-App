import { StyleSheet, View } from "react-native";
import type { QuickMomentFormat } from "@/lib/api";
import { colors } from "@/theme";

// Drawn (not photographed) illustrations for the three moment cards, used while
// MOMENT_IMAGES has no photo. Plain Views in brand colours: react-native-svg is
// not a dependency of this app and no native package may be added for this.
// 120x90 box, drawn from the bottom-right so the card's text (bottom-left) stays clear.

const SIZE = { width: 120, height: 90 };

function Flame({ left, bottom }: { left: number; bottom: number }) {
  return <View style={[s.flame, { left, bottom }]} />;
}

function Birthday() {
  return (
    <View style={SIZE}>
      {/* balloons */}
      <View style={[s.balloon, { left: 6, top: 2, width: 26, height: 30, backgroundColor: colors.purple }]} />
      <View style={[s.string, { left: 18, top: 32, height: 26 }]} />
      <View style={[s.balloon, { left: 34, top: 14, width: 22, height: 26, backgroundColor: colors.gold }]} />
      <View style={[s.string, { left: 44, top: 40, height: 20 }]} />
      {/* cake */}
      <View style={[s.layer, { right: 4, bottom: 0, width: 66, height: 20, backgroundColor: colors.pink }]} />
      <View style={[s.layer, { right: 10, bottom: 20, width: 54, height: 18, backgroundColor: colors.orange }]} />
      <View style={[s.icing, { right: 10, bottom: 36, width: 54 }]} />
      <View style={[s.candle, { right: 32, bottom: 38 }]} />
      <Flame left={82} bottom={50} />
    </View>
  );
}

function Anniversary() {
  return (
    <View style={SIZE}>
      {/* heart: a rotated square plus two circles */}
      <View style={[s.heartSquare, { right: 36, bottom: 14 }]} />
      <View style={[s.heartLobe, { right: 56, bottom: 38 }]} />
      <View style={[s.heartLobe, { right: 22, bottom: 38 }]} />
      {/* candles either side */}
      <View style={[s.candle, { left: 6, bottom: 0, height: 30 }]} />
      <Flame left={5} bottom={32} />
      <View style={[s.candle, { left: 24, bottom: 0, height: 22 }]} />
      <Flame left={23} bottom={24} />
    </View>
  );
}

function JustBecause() {
  return (
    <View style={SIZE}>
      {/* two music notes */}
      <View style={[s.noteHead, { left: 26, bottom: 6 }]} />
      <View style={[s.noteStem, { left: 42, bottom: 14, height: 44 }]} />
      <View style={[s.noteFlag, { left: 42, bottom: 50 }]} />
      <View style={[s.noteHead, { left: 62, bottom: 0, backgroundColor: colors.gold }]} />
      <View style={[s.noteStem, { left: 78, bottom: 8, height: 36, backgroundColor: colors.gold }]} />
      <View style={[s.noteFlag, { left: 78, bottom: 38, backgroundColor: colors.gold }]} />
      {/* sparkle */}
      <View style={[s.sparkBar, { right: 6, top: 8, width: 4, height: 24 }]} />
      <View style={[s.sparkBar, { right: -4, top: 18, width: 24, height: 4 }]} />
      <View style={[s.sparkDot, { right: 26, top: 40 }]} />
    </View>
  );
}

export function MomentArt({ format }: { format: QuickMomentFormat }) {
  if (format === "BIRTHDAY_SURPRISE") return <Birthday />;
  if (format === "ANNIVERSARY_SERENADE") return <Anniversary />;
  return <JustBecause />;
}

const s = StyleSheet.create({
  balloon: { position: "absolute", borderRadius: 999, opacity: 0.95 },
  string: { position: "absolute", width: 1.5, backgroundColor: colors.textDim, opacity: 0.7 },
  layer: { position: "absolute", borderRadius: 7 },
  icing: { position: "absolute", height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: colors.text },
  candle: { position: "absolute", width: 5, height: 12, borderRadius: 2, backgroundColor: colors.text },
  flame: { position: "absolute", width: 7, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  heartSquare: { position: "absolute", width: 40, height: 40, backgroundColor: colors.pink, borderRadius: 6, transform: [{ rotate: "45deg" }] },
  heartLobe: { position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: colors.pink },
  noteHead: { position: "absolute", width: 18, height: 13, borderRadius: 7, backgroundColor: colors.text, transform: [{ rotate: "-20deg" }] },
  noteStem: { position: "absolute", width: 3.5, borderRadius: 2, backgroundColor: colors.text },
  noteFlag: { position: "absolute", width: 14, height: 8, borderRadius: 4, backgroundColor: colors.text, transform: [{ rotate: "25deg" }] },
  sparkBar: { position: "absolute", borderRadius: 3, backgroundColor: colors.gold },
  sparkDot: { position: "absolute", width: 7, height: 7, borderRadius: 4, backgroundColor: colors.orange },
});
