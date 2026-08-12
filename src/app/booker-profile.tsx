import { useEffect, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { StateCityField } from "@/components/StateCityField";
import { useAuth } from "@/lib/auth-context";
import { fetchMyProfile, saveBookerProfile, uploadProfilePhoto, updateProfile, ApiError } from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

export default function BookerProfileScreen() {
  const { user, refreshSession } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState("image/jpeg");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyProfile()
      .then(({ bookerProfile }) => {
        if (bookerProfile) {
          setFullName(bookerProfile.fullName);
          setEmail(bookerProfile.email);
          setCity(bookerProfile.city ?? "");
          setState(bookerProfile.state ?? "");
          setCompanyName(bookerProfile.companyName ?? "");
        } else {
          setEmail(user?.email ?? "");
        }
      })
      .catch((err) => captureError(err, "booker-profile-fetch"))
      .finally(() => setLoading(false));
  }, [user?.email]);

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("Photo access is needed to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setError("");
      setPhotoUri(result.assets[0].uri);
      setPhotoMime(result.assets[0].mimeType ?? "image/jpeg");
    }
  }

  async function handleSave() {
    if (!fullName || !email || !city || !state) return;
    setSaving(true);
    setError("");
    try {
      if (photoUri) {
        const { url } = await uploadProfilePhoto(photoUri, photoMime);
        await updateProfile({ image: url });
      }
      await saveBookerProfile({ fullName, email, city, state, companyName: companyName || undefined });
      await refreshSession();
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Couldn't reach GiggiFi — check your internet connection and try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(fullName && email && city && state) && !saving;
  const avatarUri = photoUri ?? user?.image ?? null;
  const initial = (fullName || user?.name || user?.phone || "G").trim().charAt(0).toUpperCase();

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator color={colors.pink} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex} keyboardVerticalOffset={24}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Pressable onPress={handlePickPhoto} style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Feather name="camera" size={13} color="#fff" />
              </View>
            </Pressable>

            <FormField label="FULL NAME" value={fullName} onChangeText={setFullName} placeholder="Your name" />
            <FormField label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
              <View style={styles.readOnlyRow}>
                <Text style={styles.readOnlyText}>{user?.phone ?? "—"}</Text>
                {user?.phone ? <Feather name="check-circle" size={14} color={colors.ok} /> : null}
              </View>
            </View>

            <StateCityField city={city} onChangeCity={setCity} state={state} onChangeState={setState} />
            <FormField label="ORGANISATION / COMPANY (OPTIONAL)" value={companyName} onChangeText={setCompanyName} placeholder="Your company" />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Btn label="Save profile" onPress={handleSave} disabled={!canSave} loading={saving} style={styles.saveButton} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  avatarWrap: { alignSelf: "center", marginBottom: spacing.sm },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 84, height: 84, borderRadius: 42 },
  avatarText: { fontFamily: fonts.display, fontSize: 30, color: "#fff" },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.ink,
  },
  field: { gap: 4 },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMute,
    letterSpacing: 0.5,
  },
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
  readOnlyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  readOnlyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textDim },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.err },
  saveButton: { marginTop: spacing.sm },
});
