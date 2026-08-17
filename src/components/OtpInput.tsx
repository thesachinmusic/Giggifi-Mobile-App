import { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { colors, fonts, radii } from "@/theme";

const LENGTH = 6;

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function OtpInput({ value, onChange }: Props) {
  const inputs = useRef<(TextInput | null)[]>([]);
  const digits = value.padEnd(LENGTH, " ").split("");

  function handleChange(text: string, index: number) {
    const clean = text.replace(/\D/g, "");
    if (!clean) {
      const next = value.slice(0, index) + value.slice(index + 1);
      onChange(next);
      return;
    }

    if (clean.length > 1) {
      // A paste or OS autofill (SMS Retriever / iOS one-time-code) delivers
      // the whole code as one string to whichever box is focused — spread it
      // across the remaining boxes instead of keeping only the last digit.
      const next = (value.slice(0, index) + clean).slice(0, LENGTH);
      onChange(next);
      const nextIndex = Math.min(index + clean.length, LENGTH - 1);
      inputs.current[nextIndex]?.focus();
      return;
    }

    const next = (value.slice(0, index) + clean + value.slice(index + 1)).slice(0, LENGTH);
    onChange(next);
    if (index < LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !digits[index]?.trim() && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            inputs.current[index] = ref;
          }}
          value={digit.trim()}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
          keyboardType="number-pad"
          // Only the first box needs room for a multi-digit delivery (OS
          // autofill/paste always lands there — see the autoComplete/
          // textContentType props below). A maxLength of 1 there could
          // truncate that at the native level before onChangeText ever sees
          // more than one character. The other boxes keep maxLength=1: it's
          // what makes re-typing over an already-filled box replace rather
          // than append (raising it everywhere breaks that).
          maxLength={index === 0 ? LENGTH : 1}
          // Re-focusing an already-filled box selects its digit, so typing
          // immediately replaces it instead of appending — without this,
          // retyping over box 0 specifically could native-append into a
          // 2-character string and get misread as a fresh paste.
          selectTextOnFocus
          {...(index === 0 ? { autoComplete: "sms-otp" as const, textContentType: "oneTimeCode" as const } : null)}
          style={[styles.box, digit.trim() ? styles.boxFilled : null]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    textAlign: "center",
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    backgroundColor: colors.ink2,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.md,
  },
  boxFilled: {
    borderColor: colors.pink,
  },
});
