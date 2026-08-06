import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CATEGORY_META } from "@/lib/notification-category-meta";
import type { NotificationCategory } from "@/lib/api";
import { colors, fonts, radii, spacing } from "@/theme";

export interface ToastData {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
}

interface Props {
  toast: ToastData | null;
  onPress: () => void;
}

const HIDDEN_Y = -160;

export function NotificationToast({ toast, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(HIDDEN_Y);
  // Lags one step behind `toast` so the exit slide-up has content to
  // animate before unmounting, instead of vanishing instantly.
  const [rendered, setRendered] = useState<ToastData | null>(null);

  useEffect(() => {
    if (toast) {
      setRendered(toast);
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    } else {
      translateY.value = withTiming(HIDDEN_Y, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setRendered)(null);
      });
    }
  }, [toast, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!rendered) return null;

  const meta = CATEGORY_META[rendered.category];

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { paddingTop: insets.top + spacing.xs }, animatedStyle]}>
      <Pressable style={styles.card} onPress={onPress}>
        <Feather name={meta.icon} size={16} color={meta.color} style={styles.icon} />
        <Text style={styles.title} numberOfLines={1}>{rendered.title}</Text>
        <Text style={styles.body} numberOfLines={2}>{rendered.body}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    zIndex: 999,
  },
  card: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  icon: { marginBottom: 4 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text, marginBottom: 2 },
  body: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textDim, lineHeight: 17 },
});
