import { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import {
  fetchOrganization,
  fetchOrganizationBilling,
  inviteOrganizationMember,
  ApiError,
  type OrganizationDetail,
  type OrganizationBilling,
} from "@/lib/api";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

// Booker-role members never even attempt the billing fetch — canSeeBilling
// comes from the server (organization-service.ts's isBillingVisible), not
// a client-side guess, so this is UI convenience on top of a real
// server-side 403, not the actual boundary itself.
export default function OrganizationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [billing, setBilling] = useState<OrganizationBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchOrganization(id)
      .then((res) => {
        setOrg(res.organization);
        if (res.organization.canSeeBilling) {
          return fetchOrganizationBilling(id).then((b) => setBilling(b.billing));
        }
      })
      .catch((err) => captureError(err, "organization-detail-load"))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !org) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["bottom"]}>
          <View style={styles.centered}><ActivityIndicator color={colors.pink} /></View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const canInvite = org.myRole === "OWNER" || org.myRole === "ADMIN";

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{org.name}</Text>
          <Text style={styles.subtitle}>Your role: {org.myRole === "OWNER" ? "Owner" : org.myRole === "ADMIN" ? "Admin" : "Booker"}</Text>

          {org.canSeeBilling ? (
            <GlassCard style={styles.billingCard}>
              <View style={styles.billingHeadRow}>
                <Feather name="file-text" size={16} color={colors.purple} />
                <Text style={styles.billingTitle}>Billing</Text>
              </View>
              {billing ? (
                <>
                  <Row label="GSTIN" value={billing.gstin ?? "Not set"} />
                  <Row
                    label="Net-30 terms"
                    value={
                      billing.netTermsStatus === "APPROVED"
                        ? "Approved"
                        : billing.netTermsStatus === "PENDING_APPROVAL"
                        ? "Pending review"
                        : "Not eligible"
                    }
                  />
                </>
              ) : (
                <ActivityIndicator color={colors.pink} />
              )}
            </GlassCard>
          ) : null}

          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionTitle}>Team ({org.members.length})</Text>
            {canInvite ? (
              <Pressable onPress={() => setInviteOpen(true)} hitSlop={8}>
                <Feather name="user-plus" size={18} color={colors.purple} />
              </Pressable>
            ) : null}
          </View>

          {org.members.map((m) => (
            <GlassCard key={m.id} style={styles.memberCard}>
              <View style={styles.memberText}>
                <Text style={styles.memberName}>{m.name ?? (m.phone ? `+${m.phone.replace(/^\+/, "")}` : "Member")}</Text>
                <Text style={styles.memberMeta}>{m.role === "OWNER" ? "Owner" : m.role === "ADMIN" ? "Admin" : "Booker"}</Text>
              </View>
              <View style={[styles.statusPill, m.status === "ACTIVE" ? styles.statusActive : styles.statusPending]}>
                <Text style={styles.statusText}>{m.status === "ACTIVE" ? "Active" : "Pending"}</Text>
              </View>
            </GlassCard>
          ))}
        </ScrollView>

        <InviteModal
          visible={inviteOpen}
          organizationId={org.id}
          onClose={() => setInviteOpen(false)}
          onInvited={() => { setInviteOpen(false); load(); }}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function InviteModal({
  visible,
  organizationId,
  onClose,
  onInvited,
}: {
  visible: boolean;
  organizationId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"ADMIN" | "BOOKER">("BOOKER");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const digits = phone.replace(/\D/g, "");

  async function handleInvite() {
    if (digits.length !== 10) return;
    setSending(true);
    setError("");
    try {
      await inviteOrganizationMember(organizationId, { phone: digits, role });
      setPhone("");
      onInvited();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the invite. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Invite a teammate</Text>
          <Text style={styles.modalBody}>They'll get a notification and have to accept before they're added.</Text>

          <View style={styles.inputRow}>
            <Text style={styles.prefix}>+91</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="98765 43210"
              placeholderTextColor={colors.textMute}
              keyboardType="number-pad"
              maxLength={10}
              style={styles.phoneInput}
            />
          </View>

          <View style={styles.roleRow}>
            {(["BOOKER", "ADMIN"] as const).map((r) => (
              <Pressable key={r} style={[styles.roleCard, role === r && styles.roleCardSelected]} onPress={() => setRole(r)}>
                <Text style={[styles.roleCardText, role === r && styles.roleCardTextSelected]}>{r === "BOOKER" ? "Booker" : "Admin"}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancel} onPress={onClose} disabled={sending}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <GradientButton label="Send invite" onPress={handleInvite} disabled={digits.length !== 10} loading={sending} style={styles.modalConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, marginBottom: spacing.sm },
  billingCard: { gap: spacing.xs, marginBottom: spacing.sm },
  billingHeadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  billingTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  rowLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute },
  rowValue: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.text },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  sectionTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.text },
  memberCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  memberText: { flex: 1, gap: 2 },
  memberName: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  memberMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  statusActive: { backgroundColor: "rgba(34,197,94,0.15)" },
  statusPending: { backgroundColor: "rgba(245,158,11,0.15)" },
  statusText: { fontFamily: fonts.mono, fontSize: 10, color: colors.text },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: {
    width: "100%",
    backgroundColor: colors.ink2,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
  },
  modalTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
  modalBody: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute, lineHeight: 18 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  prefix: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textDim, marginRight: spacing.sm },
  phoneInput: { flex: 1, paddingVertical: 14, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  roleRow: { flexDirection: "row", gap: spacing.xs },
  roleCard: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink },
  roleCardSelected: { borderColor: colors.purple, backgroundColor: "rgba(168,85,247,0.18)" },
  roleCardText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.textDim },
  roleCardTextSelected: { color: "#fff" },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.err },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  modalCancel: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: "rgba(255,255,255,0.06)" },
  modalCancelText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.text },
  modalConfirm: { flex: 1 },
});
