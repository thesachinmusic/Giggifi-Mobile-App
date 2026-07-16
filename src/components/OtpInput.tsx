import { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { colors, fonts, radii } from "@/theme";

const LENGTH = 6;

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function OtpInput({ value, onChange }: Props) {
  const inputs = useRef<Array<TextInput | null>>([]);
  const digits = value.padEnd(LENGTH, " ").split("");

  function handleChange(text: string, index: number) {
    const clean = text.replace(/\D/g, "");
    if (!clean) {
      const next = value.slice(0, index) + value.slice(index + 1);
      onChange(next);
      return;
    }
    const char = clean[clean.length - 1];
    const next = (value.slice(0, index) + char + value.slice(index + 1)).slice(0, LENGTH);
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
          maxLength={1}
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
