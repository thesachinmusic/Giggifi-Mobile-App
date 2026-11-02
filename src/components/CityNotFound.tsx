import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { normalizeCustomCity } from "@/lib/india-locations";
import { colors, fonts, radii, spacing } from "@/theme";

// Shown in a city picker when the search matches nothing, so someone from a
// smaller town can still continue.
export function CityNotFound({ query, onUseCity }: { query: string; onUseCity: (city: string) => void }) {
  const custom = normalizeCustomCity(query);

  function requestCity() {
    const name = custom ?? query.trim();
    const subject = encodeURIComponent("Please add my city");
    const body = encodeURIComponent(`Hello GiggiFi, please add my city: ${name}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  }

  return (
    <View style={styles.box}>
      <Text style={styles.text}>We can&apos;t find that city in our list.</Text>
      {custom ? (
        <Pressable style={styles.button} onPress={() => onUseCity(custom)} accessibilityRole="button">
          <Text style={styles.buttonText}>Use &quot;{custom}&quot; anyway</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.secondary} onPress={requestCity} accessibilityRole="button">
        <Text style={styles.secondaryText}>Request my city</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  text: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, textAlign: "center" },
  button: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.orange },
  buttonText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: "#fff" },
  secondary: { paddingHorizontal: spacing.lg, paddingVertical: 8 },
  secondaryText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.orange },
});
