import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "@/theme";

interface Props {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

export function DateField({ label, value, onChange, minimumDate = tomorrow }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? minimumDate);

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && date) onChange(date);
      return;
    }
    if (date) setDraft(date);
  }

  function openPicker() {
    setDraft(value ?? minimumDate);
    setOpen(true);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={openPicker} style={styles.trigger}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDate(value) : "Select a date"}
        </Text>
        <Feather name="calendar" size={16} color={colors.textMute} />
      </Pressable>

      {open && Platform.OS === "android" ? (
        <DateTimePicker value={draft} mode="date" minimumDate={minimumDate} onChange={handleChange} />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <DateTimePicker value={draft} mode="date" display="inline" minimumDate={minimumDate} onChange={handleChange} themeVariant="dark" />
              <Pressable
                style={styles.doneButton}
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
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
  valueText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  placeholderText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMute,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.ink2,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  doneButton: {
    marginTop: spacing.sm,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.purple,
  },
  doneText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: "#fff",
  },
});
