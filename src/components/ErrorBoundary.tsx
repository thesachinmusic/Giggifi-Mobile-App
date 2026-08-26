import { Component, type ReactNode } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
  errorStack: string | null;
  componentStack: string | null;
  showDetails: boolean;
}

// Class component because React only supports catching render-time errors
// via getDerivedStateFromError/componentDidCatch — there's no hook
// equivalent. Deliberately kept dependency-free (no theme-driven gradients,
// no data fetching) since this is the screen that renders when something
// else has already gone wrong.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: null, errorStack: null, componentStack: null, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, errorMessage: error.message, errorStack: error.stack ?? null };
  }

  // EXPO_PUBLIC_SENTRY_DSN isn't set in this project's build config, so
  // captureError() below is currently a silent no-op — there is no other
  // record of a crash once this screen closes. Until a real DSN exists,
  // console.error (visible in Metro/EAS build logs) and the on-screen
  // "Technical details" section are the ONLY way to recover what actually
  // crashed — componentStack in particular is what pinpoints WHICH
  // component threw, and previously wasn't captured or shown anywhere.
  componentDidCatch(error: Error, errorInfo: { componentStack?: string | null }): void {
    console.error("[ErrorBoundary] Caught render error:", error, errorInfo.componentStack);
    captureError(error, "render-error-boundary");
    this.setState({ componentStack: errorInfo.componentStack ?? null });
  }

  // Prefer a true native reload via EAS Update — it clears whatever bad
  // in-memory state triggered the error, not just React's tree. Falls back
  // to a plain remount when reloadAsync rejects (Expo Go, dev builds, or
  // expo-updates otherwise disabled), where it's the only option anyway.
  handleRestart = (): void => {
    Updates.reloadAsync().catch(() => this.setState({ hasError: false, errorMessage: null, errorStack: null, componentStack: null, showDetails: false }));
  };

  handleShareDetails = (): void => {
    const { errorMessage, errorStack, componentStack } = this.state;
    const text = [
      `Error: ${errorMessage ?? "unknown"}`,
      errorStack ? `\nStack:\n${errorStack}` : "",
      componentStack ? `\nComponent stack:${componentStack}` : "",
    ].join("");
    Share.share({ message: text }).catch(() => {});
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

          <Pressable onPress={() => this.setState((s) => ({ showDetails: !s.showDetails }))} style={styles.detailsToggle}>
            <Text style={styles.detailsToggleText}>{this.state.showDetails ? "Hide" : "Show"} technical details</Text>
          </Pressable>

          {this.state.showDetails ? (
            <View style={styles.detailsBox}>
              <ScrollView style={styles.detailsScroll}>
                <Text style={styles.detailsText} selectable>
                  {this.state.errorMessage}
                  {this.state.errorStack ? `\n\n${this.state.errorStack}` : ""}
                  {this.state.componentStack ? `\n\nComponent stack:${this.state.componentStack}` : ""}
                </Text>
              </ScrollView>
              <Pressable style={styles.shareButton} onPress={this.handleShareDetails}>
                <Text style={styles.shareButtonText}>Share this error</Text>
              </Pressable>
            </View>
          ) : null}
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
  detailsToggle: { marginTop: spacing.xl, padding: spacing.sm },
  detailsToggleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.textMute,
    textDecorationLine: "underline",
  },
  detailsBox: {
    marginTop: spacing.sm,
    width: "100%",
    maxHeight: 260,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink2,
    padding: spacing.sm,
  },
  detailsScroll: { maxHeight: 180 },
  detailsText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textDim,
  },
  shareButton: {
    marginTop: spacing.sm,
    alignSelf: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  shareButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.text,
  },
});
