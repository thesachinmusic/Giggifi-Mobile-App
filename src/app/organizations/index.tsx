import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import {
  fetchMyOrganizations,
  fetchMyOrganizationInvites,
  createOrganization,
  acceptOrganizationInvite,
  ApiError,
  type OrganizationSummary,
  type OrganizationInvite,
  type OrganizationType,
} from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

const TYPE_OPTIONS: { key: OrganizationType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "RESTAURANT", label: "Restaurant/Venue", icon: "coffee" },
  { key: "CORPORATE", label: "Corporate", icon: "briefcase" },
  { key: "EVENT_COMPANY", label: "Event Company", icon: "calendar" },
];

// Business Account — team + billing on top of the same phone-verified
// identity every screen in this app already uses, not a second signup.
// Lists real orgs the user is an ACTIVE member of, any real pending
// invites waiting on their accept, and an inline create form.
export default function OrganizationsScreen() {
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchMyOrganizations(), fetchMyOrganizationInvites()])
      .then(([o, i]) => {
        setOrgs(o.organizations);
        setInvites(i.invites);
      })
      .catch((err) => captureError(err, "organizations-load"))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleAccept(memberId: string) {
    setAcceptingId(memberId);
    try {
      await acceptOrganizationInvite(memberId);
      load();
    } catch (err) {
      captureError(err, "organization-invite-accept");
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.centered}><ActivityIndicator color={colors.pink} /></View>
          ) : (
            <>
              {invites.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Pending invites</Text>
                  {invites.map((inv) => (
                    <GlassCard key={inv.memberId} style={styles.inviteCard}>
                      <View style={styles.inviteText}>
                        <Text style={styles.inviteName}>{inv.organizationName}</Text>
                        <Text style={styles.inviteSub}>Invited as {inv.role === "ADMIN" ? "Admin" : "Booker"}</Text>
                      </View>
                      <GradientButton
                        label={acceptingId === inv.memberId ? "Joining…" : "Accept"}
                        loading={acceptingId === inv.memberId}
                        onPress={() => handleAccept(inv.memberId)}
                        style={styles.acceptButton}
                      />
                    </GlassCard>
                  ))}
                </View>
              ) : null}

              <View style={styles.section}>
                <View style={styles.sectionHeadRow}>
                  <Text style={styles.sectionTitle}>Your business accounts</Text>
                  <Pressable onPress={() => setShowCreate((s) => !s)} hitSlop={8}>
                    <Feather name={showCreate ? "x" : "plus"} size={18} color={colors.purple} />
                  </Pressable>
                </View>

                {showCreate ? <CreateOrgForm onCreated={() => { setShowCreate(false); load(); }} /> : null}

                {orgs.length === 0 && !showCreate ? (
                  <GlassCard style={styles.emptyCard}>
                    <Feather name="briefcase" size={20} color={colors.textMute} />
                    <Text style={styles.emptyText}>No business account yet — create one to invite teammates and manage billing.</Text>
                  </GlassCard>
                ) : (
                  orgs.map((org) => (
                    <Pressable key={org.id} onPress={() => router.push({ pathname: "/organizations/[id]", params: { id: org.id } })}>
                      <GlassCard style={styles.orgCard}>
                        <View style={styles.orgCardText}>
                          <Text style={styles.orgCardName}>{org.name}</Text>
                          <Text style={styles.orgCardMeta}>{TYPE_OPTIONS.find((t) => t.key === org.type)?.label ?? org.type} · {org.role}</Text>
                        </View>
                        <Feather name="chevron-right" size={16} color={colors.textMute} />
                      </GlassCard>
                    </Pressable>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function CreateOrgForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<OrganizationType | null>(null);
  const [gstin, setGstin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim().length > 0 && type !== null;

  async function handleSubmit() {
    if (!canSubmit || !type) return;
    setSaving(true);
    setError("");
    try {
      await createOrganization({ name: name.trim(), type, gstin: gstin.trim() || undefined });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the business account. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard style={styles.createCard}>
      <Text style={styles.fieldLabel}>BUSINESS NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. The Sunset Terrace"
        placeholderTextColor={colors.textMute}
        style={styles.input}
      />

      <Text style={styles.fieldLabel}>TYPE</Text>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((opt) => {
          const selected = type === opt.key;
          return (
            <Pressable key={opt.key} style={[styles.typeCard, selected && styles.typeCardSelected]} onPress={() => setType(opt.key)}>
              <Feather name={opt.icon} size={16} color={selected ? "#fff" : colors.textDim} />
              <Text style={[styles.typeCardText, selected && styles.typeCardTextSelected]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>GSTIN (OPTIONAL)</Text>
      <TextInput
        value={gstin}
        onChangeText={setGstin}
        placeholder="22AAAAA0000A1Z5"
        placeholderTextColor={colors.textMute}
        autoCapitalize="characters"
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <GradientButton label="Create business account" onPress={handleSubmit} disabled={!canSubmit} loading={saving} style={styles.createButton} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  centered: { paddingVertical: spacing.xxl, alignItems: "center" },
  section: { gap: spacing.sm },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
  inviteCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  inviteText: { flex: 1, gap: 2 },
  inviteName: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  inviteSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  acceptButton: { paddingHorizontal: spacing.md },
  orgCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  orgCardText: { flex: 1, gap: 2 },
  orgCardName: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: colors.text },
  orgCardMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  emptyCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, textAlign: "center" },
  createCard: { gap: spacing.sm, marginBottom: spacing.sm },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5 },
  input: {
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
  typeRow: { flexDirection: "row", gap: spacing.xs },
  typeCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink2,
  },
  typeCardSelected: { borderColor: colors.purple, backgroundColor: "rgba(168,85,247,0.18)" },
  typeCardText: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.textDim, textAlign: "center" },
  typeCardTextSelected: { color: "#fff" },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.err },
  createButton: { marginTop: spacing.xs },
});
