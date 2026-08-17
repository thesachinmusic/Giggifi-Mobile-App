import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Class component because React only supports catching render-time errors
// via getDerivedStateFromError/componentDidCatch — there's no hook
// equivalent. Deliberately kept dependency-free (no theme-driven gradients,
// no data fetching) since this is the screen that renders when something
// else has already gone wrong.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    captureError(error, "render-error-boundary");
  }

  // Prefer a true native reload via EAS Update — it clears whatever bad
  // in-memory state triggered the error, not just React's tree. Falls back
  // to a plain remount when reloadAsync rejects (Expo Go, dev builds, or
  // expo-updates otherwise disabled), where it's the only option anyway.
  handleRestart = (): void => {
    Updates.reloadAsync().catch(() => this.setState({ hasError: false }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>We&apos;ve been notified and are looking into it.</Text>
          <Pressable style={styles.button} onPress={this.handleRestart}>
            <Text style={styles.buttonText}>Restart</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.pink,
  },
  buttonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: "#fff",
  },
});
