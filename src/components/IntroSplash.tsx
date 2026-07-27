import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text } from "react-native";
import { colors, fonts } from "@/theme";

// Brief in-app intro shown once per cold start, right after the native splash
// hides: logo first, tagline fades in a beat later, then the whole thing
// fades out into the real app. ~1.5s total.
export function IntroSplash({ onFinish }: { onFinish: () => void }) {
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(350),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(rootOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [onFinish, rootOpacity, taglineOpacity]);

  return (
    <Animated.View style={[styles.root, { opacity: rootOpacity }]} pointerEvents="none">
      <Image source={require("@/assets/images/giggifi-logo-cropped.png")} style={styles.logo} resizeMode="contain" />
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Book artists & vendors in minutes.
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  logo: { width: "78%", maxWidth: 340, aspectRatio: 2.43 },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    letterSpacing: 1,
    color: colors.textDim,
  },
});
