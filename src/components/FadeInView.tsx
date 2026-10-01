import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

// Subtle entrance for a card: fades in while rising ~10px. Short and used only
// on a screen's main blocks; `delay` staggers neighbours a little.
export function FadeInView({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: ViewStyle }) {
  return (
    <Animated.View entering={FadeInDown.duration(320).delay(delay)} style={style}>
      {children}
    </Animated.View>
  );
}
