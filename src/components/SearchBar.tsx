import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radii, spacing } from "@/theme";

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  editable?: boolean;
  onPress?: () => void;
  rightSlot?: React.ReactNode;
}

// Zepto/Blinkit-style pill search bar — big touch target, icon-led, sits
// at the top of Home and Browse so search is always one thumb-reach away.
export function SearchBar({ value, onChangeText, onSubmit, placeholder = "Search artists, DJs, bands…", editable = true, onPress, rightSlot }: Props) {
  const content = (
    <View style={styles.row}>
      <Feather name="search" size={18} color={colors.textMute} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.textMute}
        editable={editable}
        pointerEvents={editable ? "auto" : "none"}
        style={styles.input}
        returnKeyType="search"
      />
      {rightSlot}
    </View>
  );

  if (!editable && onPress) {
    return (
      <Pressable onPress={onPress} style={styles.wrap}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.wrap}>{content}</View>;
}

export function SearchBarStatic({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View style={styles.row}>
        <Feather name="search" size={18} color={colors.textMute} />
        <Text style={styles.staticLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14.5,
    color: colors.text,
  },
  staticLabel: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    color: colors.textMute,
  },
});
