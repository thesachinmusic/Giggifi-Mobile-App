import {
  useFonts,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
} from "@expo-google-fonts/inter-tight";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";

// Mirrors the website's --font-display (Bricolage Grotesque), --font-body
// (Inter Tight), and --font-mono (JetBrains Mono, used for the uppercase
// eyebrow/label styling throughout the site).
export const fonts = {
  display: "BricolageGrotesque_600SemiBold",
  displayBold: "BricolageGrotesque_700Bold",
  displayMedium: "BricolageGrotesque_500Medium",
  body: "InterTight_400Regular",
  bodyMedium: "InterTight_500Medium",
  bodySemiBold: "InterTight_600SemiBold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
} as const;

export function useAppFonts() {
  return useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
}
