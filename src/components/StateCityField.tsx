import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { INDIA_STATES, INDIA_STATE_NAMES, findStateForCity } from "@/lib/india-locations";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const ALL_CITIES = Array.from(new Set(Object.values(INDIA_STATES).flat())).sort();

interface Props {
  city: string;
  onChangeCity: (city: string) => void;
  state?: string;
  onChangeState?: (state: string) => void;
  cityLabel?: string;
  stateLabel?: string;
}

type Step = "state" | "city";

// Same trigger+Modal shape as DateField, so a form mixing this with dates
// looks and behaves consistently. Two modes: pass `state`/`onChangeState`
// for the full state->city flow (state picked first, then city filtered to
// it); omit both for a city-only field (flat search across every city in
// the dataset) — used for "event city" fields that don't also collect a
// state.
export function StateCityField({ city, onChangeCity, state, onChangeState, cityLabel = "CITY", stateLabel = "STATE" }: Props) {
  const hasState = onChangeState !== undefined;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("state");
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [draftState, setDraftState] = useState(state ?? "");

  function openPicker() {
    setQuery("");
    setLocError("");
    if (hasState) {
      setDraftState(state ?? "");
      setStep(state ? "city" : "state");
    } else {
      setStep("city");
    }
    setOpen(true);
  }

  function pickState(s: string) {
    setDraftState(s);
    onChangeState?.(s);
    setQuery("");
    setStep("city");
  }

  function pickCity(c: string) {
    onChangeCity(c);
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
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [address] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const geoCity = address?.city ?? address?.subregion ?? null;
      const geoRegion = address?.region ?? null;
      if (!geoCity && !geoRegion) {
        setLocError("Couldn't determine your city — please select manually.");
        return;
      }
      const resolvedState = (geoCity ? findStateForCity(geoCity) : null) ?? geoRegion ?? "";
      if (hasState) {
        if (resolvedState) onChangeState?.(resolvedState);
        onChangeCity(geoCity ?? resolvedState);
      } else {
        onChangeCity(geoCity ?? resolvedState);
      }
      setOpen(false);
    } catch (err) {
      captureError(err, "state-city-use-location");
      setLocError("Couldn't get your location — please select manually.");
    } finally {
      setLocating(false);
    }
  }

  const stateResults = useMemo(() => {
    if (!query.trim()) return INDIA_STATE_NAMES;
    const q = query.trim().toLowerCase();
    return INDIA_STATE_NAMES.filter((s) => s.toLowerCase().includes(q));
  }, [query]);

  const cityResults = useMemo(() => {
    const pool = hasState ? (INDIA_STATES[draftState] ?? []) : ALL_CITIES;
    if (!query.trim()) return pool;
    const q = query.trim().toLowerCase();
    return pool.filter((c) => c.toLowerCase().includes(q));
  }, [query, draftState, hasState]);

  return (
    <>
      {hasState ? (
        <View style={styles.row}>
          <View style={styles.rowField}>
            <Text style={styles.label}>{stateLabel}</Text>
            <Pressable onPress={openPicker} style={styles.trigger}>
              <Text style={state ? styles.valueText : styles.placeholderText} numberOfLines={1}>
                {state || "Select"}
              </Text>
              <Feather name="chevron-down" size={15} color={colors.textMute} />
            </Pressable>
          </View>
          <View style={styles.rowField}>
            <Text style={styles.label}>{cityLabel}</Text>
            <Pressable onPress={openPicker} style={styles.trigger}>
              <Text style={city ? styles.valueText : styles.placeholderText} numberOfLines={1}>
                {city || "Select"}
              </Text>
              <Feather name="chevron-down" size={15} color={colors.textMute} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={styles.label}>{cityLabel}</Text>
          <Pressable onPress={openPicker} style={styles.trigger}>
            <Text style={city ? styles.valueText : styles.placeholderText} numberOfLines={1}>
              {city || "Select"}
            </Text>
            <Feather name="chevron-down" size={15} color={colors.textMute} />
          </Pressable>
        </View>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              {hasState && step === "city" ? (
                <Pressable onPress={() => { setStep("state"); setQuery(""); }} hitSlop={8}>
                  <Feather name="chevron-left" size={18} color={colors.textDim} />
                </Pressable>
              ) : <View style={{ width: 18 }} />}
              <Text style={styles.sheetTitle}>
                {step === "state" ? "Select state" : hasState ? `Select city in ${draftState}` : "Select city"}
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Feather name="x" size={18} color={colors.textDim} />
              </Pressable>
            </View>

            {step === "state" || !hasState ? (
              <Pressable onPress={useMyLocation} style={styles.locateRow} disabled={locating}>
                {locating ? (
                  <ActivityIndicator size="small" color={colors.orange} />
                ) : (
                  <Feather name="crosshair" size={15} color={colors.orange} />
                )}
                <Text style={styles.locateText}>{locating ? "Detecting your location…" : "Use my current location"}</Text>
              </Pressable>
            ) : null}
            {locError ? <Text style={styles.locError}>{locError}</Text> : null}

            <View style={styles.searchRow}>
              <Feather name="search" size={14} color={colors.textMute} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={step === "state" ? "Search states" : "Search cities"}
                placeholderTextColor={colors.textMute}
                style={styles.searchInput}
                autoCapitalize="words"
              />
            </View>

            <FlatList
              data={step === "state" ? stateResults : cityResults}
              keyExtractor={(item) => item}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => (step === "state" ? pickState(item) : pickCity(item))}
                  style={styles.optionRow}
                >
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
  row: { flexDirection: "row", gap: spacing.sm },
  rowField: { flex: 1, gap: 4 },
  field: { gap: 4 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  valueText: { fontFamily: fonts.body, fontSize: 14, color: colors.text, flexShrink: 1 },
  placeholderText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute },
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
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sheetTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
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
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  list: { maxHeight: 320 },
  optionRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  optionText: { fontFamily: fonts.body, fontSize: 14.5, color: colors.text },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMute,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
});
