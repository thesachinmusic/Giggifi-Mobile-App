import * as Haptics from "expo-haptics";

// Thin fire-and-forget wrappers — haptics failing (unsupported device, iOS
// Low Power Mode) should never surface as an app error.
export function hapticSelect(): void {
  Haptics.selectionAsync().catch(() => {});
}

export function hapticImpact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light): void {
  Haptics.impactAsync(style).catch(() => {});
}

export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
