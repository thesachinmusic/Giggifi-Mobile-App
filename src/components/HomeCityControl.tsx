import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { ALL_CITIES } from "@/lib/india-locations";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

interface Props {
  city: string | null;
  onChange: (city: string) => void;
}

// Home-header equivalent of StateCityField's picker — a compact pill trigger
// instead of a form field, and city-only (no state step). Ranks Home's
// listings by city, never filters them — see lib/home-ranking.ts.
export function HomeCityControl({ city, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  function openPicker() {
    setQuery("");
    setLocError("");
    setOpen(true);
  }

  function pick(c: string) {
    onChange(c);
    setOpen(false);
  }

  async function useMyLocation() {
    setLocating(true);
    setLocError("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocError("Location access denied — please select manually.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const [address] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const geoCity = address?.city ?? address?.subregion ?? null;
      if (!geoCity) {
        setLocError("Couldn't determine your city — please select manually.");
        return;
      }
      onChange(geoCity);
      setOpen(false);
    } catch (err) {
      captureError(err, "home-city-use-location");
      setLocError("Couldn't get your location — please select manually.");
    } finally {
      setLocating(false);
    }
  }

  const results = useMemo(() => {
    if (!query.trim()) return ALL_CITIES;
    const q = query.trim().toLowerCase();
    return ALL_CITIES.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  return (
    <>
      <Pressable
        onPress={openPicker}
        style={styles.pill}
        accessibilityRole="button"
        accessibilityLabel={city ? `Change city, currently ${city}` : "Set your city"}
      >
        <Feather name="map-pin" size={12} color={colors.orange} />
        <Text style={styles.pillText} numberOfLines={1}>{city ?? "Set your city"}</Text>
        <Feather name="chevron-down" size={12} color={colors.textMute} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Your city</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={15} accessibilityRole="button" accessibilityLabel="Close">
                <Feather name="x" size={18} color={colors.textDim} />
              </Pressable>
            </View>
            <Text style={styles.sheetSub}>
              We show local artists first — nothing from other cities gets hidden, since many artists travel.
            </Text>

            <Pressable onPress={useMyLocation} style={styles.locateRow} disabled={locating}>
              {locating ? <ActivityIndicator size="small" color={colors.orange} /> : <Feather name="crosshair" size={15} color={colors.orange} />}
              <Text style={styles.locateText}>{locating ? "Detecting your location…" : "Use my current location"}</Text>
            </Pressable>
            {locError ? <Text style={styles.locError}>{locError}</Text> : null}

            <View style={styles.searchRow}>
              <Feather name="search" size={14} color={colors.textMute} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search cities"
                placeholderTextColor={colors.textMute}
                style={styles.searchInput}
                autoCapitalize="words"
              />
            </View>

            <FlatList
              data={results}
              keyExtractor={(item) => item}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable onPress={() => pick(item)} style={styles.optionRow}>
                  <Text style={styles.optionText}>{item}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No matches</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.text,
    maxWidth: 120,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.ink2,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    maxHeight: "80%",
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  sheetTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  sheetSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMute, marginBottom: spacing.sm },
  locateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    backgroundColor: "rgba(255,138,61,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,138,61,0.3)",
    marginBottom: spacing.sm,
  },
  locateText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.orange },
  locError: { fontFamily: fonts.body, fontSize: 12, color: colors.err, marginBottom: spacing.sm },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 14, color: colors.text },
  list: { maxHeight: 320 },
  optionRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionText: { fontFamily: fonts.body, fontSize: 14.5, color: colors.text },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, textAlign: "center", paddingVertical: spacing.lg },
});
