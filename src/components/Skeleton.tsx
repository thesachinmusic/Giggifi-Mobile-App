import { useEffect } from "react";
import type { DimensionValue, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { colors, radii } from "@/theme";

interface Props {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

// Shimmering placeholder block, shaped per-use via width/height/borderRadius
// rather than being one generic "card" — screens compose it into layouts
// that echo their real content (see (tabs)/index.tsx, browse.tsx, etc).
export function Skeleton({ width = "100%", height = 16, borderRadius = radii.sm, style }: Props) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: colors.surface2 }, animatedStyle, style]} />;
}
