import { Component, type ReactNode } from "react";
import { Platform, StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { visualGradients } from "@/theme";

type Stops = readonly [string, string, ...string[]];

interface Props {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  // Defaults to the headline gradient; pass visualGradients.number for stat
  // figures, or any custom stops.
  colors?: Stops;
  numberOfLines?: number;
}

// Falls back to a plain solid-colour Text if the masked-view native component
// can't render (not linked in a given dev build, or web) — the words are
// always shown, at worst without the gradient.
class MaskGuard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// Gradient-filled text: the Text is the mask, a LinearGradient is what shows
// through it. The invisible copy inside the gradient is what gives the view
// its size, so layout is identical to a normal Text with the same style.
export function GradientText({ children, style, colors = visualGradients.headline, numberOfLines }: Props) {
  const solid = (
    <Text style={[style, { color: colors[Math.min(1, colors.length - 1)] }]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
  if (Platform.OS === "web") return solid;

  return (
    <MaskGuard fallback={solid}>
      <MaskedView
        style={styles.mask}
        maskElement={
          <Text style={[style, styles.maskText]} numberOfLines={numberOfLines}>
            {children}
          </Text>
        }
      >
        <LinearGradient colors={colors} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}>
          <Text style={[style, styles.hiddenText]} numberOfLines={numberOfLines}>
            {children}
          </Text>
        </LinearGradient>
      </MaskedView>
    </MaskGuard>
  );
}

const styles = StyleSheet.create({
  // Shrink-wraps the text so a centred or left-aligned parent behaves as it
  // would with a plain Text.
  mask: { alignSelf: "flex-start" },
  maskText: { backgroundColor: "transparent", color: "#000" },
  hiddenText: { opacity: 0 },
});
