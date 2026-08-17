import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { placesAutocomplete, placesDetails, type PlaceDetails, type PlacePrediction } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

interface Props {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (place: PlaceDetails) => void;
}

const DEBOUNCE_MS = 350;

// Backed by the same /api/places/autocomplete + /api/places/details endpoints
// the website's VenueAutocomplete uses — no /api/mobile prefix, request()
// calls them directly. No debounce hook exists elsewhere in this app, so a
// plain setTimeout/clearTimeout pair does the job here.
export function PlacesAutocompleteField({ label, placeholder, value, onChangeText, onSelect }: Props) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setPredictions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await placesAutocomplete(value.trim());
        setPredictions(results);
      } catch (err) {
        captureError(err, "places-autocomplete");
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  async function pick(prediction: PlacePrediction) {
    setPredictions([]);
    setFocused(false);
    try {
      const details = await placesDetails(prediction.place_id);
      onSelect(details);
    } catch (err) {
      captureError(err, "places-details");
    }
  }

  const showDropdown = focused && (loading || predictions.length > 0);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          placeholderTextColor={colors.textMute}
          style={styles.input}
        />
        {loading ? <ActivityIndicator size="small" color={colors.textMute} style={styles.icon} /> : <Feather name="map-pin" size={15} color={colors.textMute} style={styles.icon} />}
      </View>

      {showDropdown ? (
        <View style={styles.dropdown}>
          {predictions.map((p) => (
            <Pressable key={p.place_id} onPress={() => pick(p)} style={styles.option}>
              <Text style={styles.optionMain} numberOfLines={1}>{p.main_text}</Text>
              <Text style={styles.optionSecondary} numberOfLines={1}>{p.secondary_text}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4, zIndex: 10 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  icon: { marginLeft: spacing.xs },
  dropdown: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    marginTop: 4,
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 2,
  },
  optionMain: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.text },
  optionSecondary: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMute },
});
