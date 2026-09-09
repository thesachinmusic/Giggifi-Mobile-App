import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { GradientButton } from "@/components/GradientButton";
import { DateField } from "@/components/DateField";
import { useAuth } from "@/lib/auth-context";
import { updateProfile, confirmDateOfBirth, ApiError } from "@/lib/api";
import { isValidEmail } from "@/lib/format";
import { colors, fonts, radii, spacing } from "@/theme";

const GENDER_OPTIONS = ["Male", "Female", "Other"];
const TODAY = new Date();
const MIN_BIRTH_DATE = new Date(new Date().setFullYear(TODAY.getFullYear() - 100));
const MIN_ANNIVERSARY_DATE = new Date(new Date().setFullYear(TODAY.getFullYear() - 80));

// Every field here is individually optional — this is the ongoing, soft
// nudge from Home's ProfileCompletionBadge, never a forced step. dateOfBirth
// saves through a separate call (confirmDateOfBirth) since it's the one
// field with real backend enforcement (under-18 block) the others don't
// have; everything else goes through updateProfile in one PATCH.
export default function EditProfileScreen() {
  const { user, refreshSession } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [gender, setGender] = useState(user?.gender ?? "");
  const [religion, setReligion] = useState(user?.religion ?? "");
  const [dob, setDob] = useState<Date | null>(user?.dateOfBirth ? new Date(user.dateOfBirth) : null);
  const [anniversary, setAnniversary] = useState<Date | null>(user?.anniversary ? new Date(user.anniversary) : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (email.trim() && !isValidEmail(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const dobChanged = dob && dob.toISOString().slice(0, 10) !== (user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : null);
      if (dobChanged) await confirmDateOfBirth(dob!.toISOString());

      await updateProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        gender: gender || undefined,
        religion: religion.trim() || undefined,
        anniversary: anniversary ? anniversary.toISOString() : undefined,
      });

      await refreshSession();
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            All optional — fill in whatever you&apos;d like, whenever you&apos;d like.
          </Text>

          <FormField label="NAME" value={name} onChangeText={setName} placeholder="Your name" />
          <FormField label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>GENDER</Text>
            <View style={styles.pillRow}>
              {GENDER_OPTIONS.map((g) => (
                <Pressable
                  key={g}
                  style={[styles.pill, gender === g ? styles.pillActive : null]}
                  onPress={() => setGender(gender === g ? "" : g)}
                >
                  <Text style={[styles.pillText, gender === g ? styles.pillTextActive : null]}>{g}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <DateField label="DATE OF BIRTH" value={dob} onChange={setDob} minimumDate={MIN_BIRTH_DATE} maximumDate={TODAY} />

          <FormField label="RELIGION" value={religion} onChangeText={setReligion} placeholder="Optional" />

          <DateField label="ANNIVERSARY" value={anniversary} onChange={setAnniversary} minimumDate={MIN_ANNIVERSARY_DATE} maximumDate={TODAY} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <GradientButton label="Save" onPress={handleSave} loading={saving} style={styles.saveButton} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.textMute} style={styles.fieldInput} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  intro: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute, marginBottom: spacing.xs },
  field: { gap: 4 },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5 },
  fieldInput: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  pillRow: { flexDirection: "row", gap: spacing.sm },
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink2,
  },
  pillActive: { borderColor: colors.purple, backgroundColor: "rgba(168,85,247,0.15)" },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMute },
  pillTextActive: { color: colors.text },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.err },
  saveButton: { marginTop: spacing.sm },
});
