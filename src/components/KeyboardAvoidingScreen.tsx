import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  // Matches how far the focused field's screen sits below a fixed header —
  // 80 covers the common topbar+padding shape used across most screens; a
  // screen with a taller or shorter header should pass its own value, same
  // as the individual KeyboardAvoidingViews this replaces used to.
  verticalOffset?: number;
}

// The same Platform.OS === "ios" ? "padding" : "height" KeyboardAvoidingView
// was being hand-copied onto every form screen, and it's exactly the piece
// that kept getting left off new screens (my-event, booking detail, the
// artist app's enquiry reply modal) — one shared wrapper so a new screen
// with a TextInput reaches for this instead of reimplementing the ternary.
export function KeyboardAvoidingScreen({ children, style, verticalOffset = 80 }: Props) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={verticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
