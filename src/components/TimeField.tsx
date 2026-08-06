import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "@/theme";

interface Props {
  label: string;
  hour: number; // 0-23
  onChange: (hour: number) => void;
}

function hourToDate(hour: number): Date {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
}

export function TimeField({ label, hour, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(hourToDate(hour));

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && date) onChange(date.getHours());
      return;
    }
    if (date) setDraft(date);
  }

  function openPicker() {
    setDraft(hourToDate(hour));
    setOpen(true);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={openPicker} style={styles.trigger}>
        <Text style={styles.valueText}>{formatHour(hour)}</Text>
        <Feather name="clock" size={16} color={colors.textMute} />
      </Pressable>

      {open && Platform.OS === "android" ? (
        <DateTimePicker value={draft} mode="time" onChange={handleChange} />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <DateTimePicker value={draft} mode="time" display="spinner" onChange={handleChange} themeVariant="dark" />
              <Pressable
                style={styles.doneButton}
                onPress={() => {
                  onChange(draft.getHours());
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

function formatHour(hour: number): string {
  return hourToDate(hour).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

const styles = StyleSheet.create({
  field: { gap: 4, flex: 1 },
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
    alignItems: "center",
  },
  doneButton: {
    marginTop: spacing.sm,
    alignSelf: "stretch",
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
