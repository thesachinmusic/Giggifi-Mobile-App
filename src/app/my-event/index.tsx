import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton as Btn } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { DateField } from "@/components/DateField";
import { Skeleton } from "@/components/Skeleton";
import { KeyboardAvoidingScreen } from "@/components/KeyboardAvoidingScreen";
import { VENDOR_CATEGORIES } from "@/lib/vendor-categories";
import {
  fetchEventPlans,
  fetchEventPlan,
  createEventPlan,
  updateEventPlanChecklist,
  ApiError,
  type EventPlanSummary,
  type EventPlanDetail,
  type EventPlanChecklistItem,
} from "@/lib/api";
import { colors, fonts, radii, spacing } from "@/theme";

// Ticks once a minute, not once a second — the mockup's DAYS/HOURS/MINS
// granularity doesn't need per-second precision, and a 1s interval on a
// screen that can stay open a while (someone lingering while planning) is
// needless battery drain for no visible benefit.
const TICK_MS = 60_000;

// Mirrors PERFORMER_TYPES in the website's artist onboarding route
// (app/api/mobile/artist/onboarding/route.ts) — the real values
// ArtistProfile.performerType can hold, which is what getEventPlanDetail's
// isBooked matching and Browse's category filter both key off. Deliberately
// NOT lib/categories.ts's CATEGORIES (Browse's own pill row) — that list
// swaps "Other" for "Celebrity" and would silently break isBooked matching
// for anyone who picks "Other" here.
const ARTIST_CATEGORIES = [
  { label: "Singer", emoji: "🎤" },
  { label: "DJ", emoji: "🎧" },
  { label: "Live Band", emoji: "🎸" },
  { label: "Comedian", emoji: "🎭" },
  { label: "Dancer", emoji: "💃" },
  { label: "Anchor", emoji: "🎙️" },
  { label: "Instrumentalist", emoji: "🎻" },
  { label: "Magician", emoji: "🪄" },
  { label: "Other", emoji: "✨" },
] as const;

function useCountdown(eventDate: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    const diff = Math.max(0, new Date(eventDate).getTime() - now);
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    return { days, hours, mins, isPast: diff === 0 && new Date(eventDate).getTime() < now };
  }, [eventDate, now]);
}

export default function MyEventScreen() {
  const [plans, setPlans] = useState<EventPlanSummary[] | null>(null);
  const [plan, setPlan] = useState<EventPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const { plans: list } = await fetchEventPlans();
      setPlans(list);
      if (list.length === 0) {
        setPlan(null);
        return;
      }
      // Nearest upcoming by eventDate; if every plan is already in the
      // past, fall back to the most recently dated one rather than
      // showing nothing.
      const now = Date.now();
      const upcoming = list.filter((p) => new Date(p.eventDate).getTime() >= now);
      const target = (upcoming.length ? upcoming : list).sort(
        (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
      )[0];
      const { plan: detail } = await fetchEventPlan(target.id);
      setPlan(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your event.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Single path for every checklist mutation (toggle, free-text add,
  // category-picker add, allocated-amount edit) — optimistic update so the
  // screen reflects the change immediately, reverting to server truth via
  // load() if the PATCH actually failed.
  async function handleChecklistChange(next: EventPlanChecklistItem[]) {
    if (!plan) return;
    setPlan({ ...plan, checklist: next });
    try {
      await updateEventPlanChecklist(plan.id, next);
    } catch {
      await load();
    }
  }

  async function handleToggleItem(index: number) {
    if (!plan) return;
    const next = plan.checklist.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
    await handleChecklistChange(next);
  }

  const [pickerOpen, setPickerOpen] = useState(false);

  async function handlePickCategory(kind: "artist" | "vendor", category: string) {
    if (!plan) return;
    const next: EventPlanChecklistItem[] = [...plan.checklist, { label: category, done: false, kind, category }];
    await handleChecklistChange(next);
  }

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <Topbar />
          <View style={styles.scroll}>
            <Skeleton height={140} borderRadius={radii.xl} />
            <Skeleton height={120} borderRadius={radii.xl} style={styles.skeletonGap} />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (error) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <Topbar />
          <View style={styles.centered}>
            <Text style={styles.muted}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!plan) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <Topbar />
          <CreatePlanForm onCreated={() => { setLoading(true); load(); }} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <Topbar />
        <KeyboardAvoidingScreen verticalOffset={80}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <EventHero plan={plan} />
            {plan.totalBudget ? <BudgetCard plan={plan} /> : null}
            <Text style={styles.sectionTitle}>Checklist</Text>
            <ChecklistCard plan={plan} onToggle={handleToggleItem} onChecklistChange={handleChecklistChange} />
            <Pressable style={styles.addVendorCta} onPress={() => setPickerOpen(true)}>
              <Text style={styles.addVendorCtaText}>+ Add Vendor/Artist</Text>
            </Pressable>
            {plans && plans.length > 1 ? (
              <Text style={styles.multiPlanHint}>
                You have {plans.length} events planned — showing the nearest one.
              </Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingScreen>
      </SafeAreaView>

      <AddVendorArtistModal visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={handlePickCategory} />
    </GradientBackground>
  );
}

function Topbar() {
  return (
    <View style={styles.topbar}>
      <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
        <Feather name="chevron-left" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.tbName}>My Event</Text>
    </View>
  );
}

// Two-step: pick Artist or Vendor, then a real category from that
// taxonomy — same bottom-sheet Modal shape as StateCityField/
// HomeCityControl (a plain list picker, not a video overlay, so the
// Android touch-reliability concerns that ruled out <Modal> for
// FullScreenVideoPlayer don't apply here).
function AddVendorArtistModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (kind: "artist" | "vendor", category: string) => void;
}) {
  const [step, setStep] = useState<"kind" | "category">("kind");
  const [kind, setKind] = useState<"artist" | "vendor" | null>(null);

  function reset() {
    setStep("kind");
    setKind(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickKind(k: "artist" | "vendor") {
    setKind(k);
    setStep("category");
  }

  function pickCategory(category: string) {
    if (!kind) return;
    onPick(kind, category);
    reset();
    onClose();
  }

  const categoryOptions = kind === "vendor" ? VENDOR_CATEGORIES : ARTIST_CATEGORIES;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={pickerStyles.backdrop} onPress={handleClose}>
        <Pressable style={pickerStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={pickerStyles.sheetHeader}>
            {step === "category" ? (
              <Pressable onPress={() => setStep("kind")} hitSlop={15} accessibilityRole="button" accessibilityLabel="Back">
                <Feather name="chevron-left" size={18} color={colors.textDim} />
              </Pressable>
            ) : (
              <View style={{ width: 18 }} />
            )}
            <Text style={pickerStyles.sheetTitle}>
              {step === "kind" ? "Add to checklist" : kind === "vendor" ? "Select vendor category" : "Select artist category"}
            </Text>
            <Pressable onPress={handleClose} hitSlop={15} accessibilityRole="button" accessibilityLabel="Close">
              <Feather name="x" size={18} color={colors.textDim} />
            </Pressable>
          </View>

          {step === "kind" ? (
            <View style={pickerStyles.kindRow}>
              <Pressable style={pickerStyles.kindOption} onPress={() => pickKind("artist")}>
                <Feather name="mic" size={22} color={colors.purple} />
                <Text style={pickerStyles.kindOptionText}>Artist</Text>
              </Pressable>
              <Pressable style={pickerStyles.kindOption} onPress={() => pickKind("vendor")}>
                <Feather name="briefcase" size={22} color={colors.orange} />
                <Text style={pickerStyles.kindOptionText}>Vendor</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={pickerStyles.list} showsVerticalScrollIndicator={false}>
              {categoryOptions.map((c) => (
                <Pressable key={c.label} onPress={() => pickCategory(c.label)} style={pickerStyles.optionRow}>
                  <Text style={pickerStyles.optionEmoji}>{c.emoji}</Text>
                  <Text style={pickerStyles.optionText}>{c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EventHero({ plan }: { plan: EventPlanDetail }) {
  const { days, hours, mins, isPast } = useCountdown(plan.eventDate);
  return (
    <GlassCard style={styles.hero}>
      <Text style={styles.heroName}>{plan.eventName}</Text>
      <Text style={styles.heroDate}>
        {new Date(plan.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </Text>
      {isPast ? (
        <Text style={styles.heroPast}>This event has passed</Text>
      ) : (
        <View style={styles.countdownRow}>
          <CountdownTile value={days} label="DAYS" />
          <CountdownTile value={hours} label="HOURS" />
          <CountdownTile value={mins} label="MINS" />
        </View>
      )}
    </GlassCard>
  );
}

function CountdownTile({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.cdTile}>
      <Text style={styles.cdNum}>{String(value).padStart(2, "0")}</Text>
      <Text style={styles.cdLabel}>{label}</Text>
    </View>
  );
}

function BudgetCard({ plan }: { plan: EventPlanDetail }) {
  const total = plan.totalBudget ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((plan.spent / total) * 100)) : 0;
  // Purely a planning number, computed client-side same as the countdown —
  // separate from `spent` above (the real, live sum over actual Bookings,
  // untouched by this). Not clamped at 0: over-allocating is a legitimate
  // mid-planning state (revising other lines down), not an error, so it's
  // shown honestly as a negative/red "over" figure rather than blocked.
  const allocated = plan.checklist.reduce((sum, item) => sum + (item.allocatedAmount ?? 0), 0);
  const remaining = total - allocated;
  return (
    <>
      <Text style={styles.sectionTitle}>Budget</Text>
      <GlassCard style={styles.budgetCard}>
        <View style={styles.budgetTop}>
          <Text style={styles.budgetSpent}>
            ₹{plan.spent.toLocaleString("en-IN")} <Text style={styles.budgetSpentLabel}>spent</Text>
          </Text>
          <Text style={styles.budgetTotal}>of ₹{total.toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.budgetBarTrack}>
          <View style={[styles.budgetBarFill, { width: `${pct}%` }]} />
        </View>
        {plan.categories.length ? (
          <View style={styles.budgetCats}>
            {plan.categories.map((c) => (
              <View key={c.category} style={styles.budgetChip}>
                <Text style={styles.budgetChipText}>{c.category} · ₹{Math.round(c.amount / 1000)}k</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.allocatedRow}>
          <Text style={styles.allocatedRowText}>₹{allocated.toLocaleString("en-IN")} allocated</Text>
          <Text style={[styles.allocatedRowText, remaining < 0 ? styles.remainingOver : styles.remainingOk]}>
            {remaining < 0
              ? `₹${Math.abs(remaining).toLocaleString("en-IN")} over`
              : `₹${remaining.toLocaleString("en-IN")} remaining`}
          </Text>
        </View>
      </GlassCard>
    </>
  );
}

function ChecklistCard({
  plan,
  onToggle,
  onChecklistChange,
}: {
  plan: EventPlanDetail;
  onToggle: (index: number) => void;
  onChecklistChange: (next: EventPlanChecklistItem[]) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingAmountIndex, setEditingAmountIndex] = useState<number | null>(null);
  const [amountDraft, setAmountDraft] = useState("");

  async function handleAdd() {
    if (!draft.trim()) return;
    const next: EventPlanChecklistItem[] = [...plan.checklist, { label: draft.trim(), done: false }];
    setDraft("");
    setAdding(false);
    await onChecklistChange(next);
  }

  function startEditAmount(index: number, current?: number) {
    setEditingAmountIndex(index);
    setAmountDraft(current ? String(current) : "");
  }

  async function commitAmount(index: number) {
    const allocatedAmount = amountDraft.trim() ? Number(amountDraft) : undefined;
    const next = plan.checklist.map((item, i) => (i === index ? { ...item, allocatedAmount } : item));
    setEditingAmountIndex(null);
    await onChecklistChange(next);
  }

  function handleBookCategory(item: EventPlanChecklistItem) {
    if (!item.category) return;
    router.push({
      pathname: "/(tabs)/browse",
      params: { vertical: item.kind === "vendor" ? "vendor" : "artist", category: item.category },
    });
  }

  return (
    <GlassCard style={styles.checklistCard}>
      {plan.checklist.length === 0 ? (
        <Text style={styles.checklistEmpty}>Nothing on your checklist yet.</Text>
      ) : (
        plan.checklist.map((item, i) => (
          <View key={`${item.label}-${i}`} style={styles.checklistItemWrap}>
            <Pressable style={styles.checklistItem} onPress={() => onToggle(i)}>
              <View style={[styles.cb, item.done ? styles.cbDone : styles.cbPending]}>
                {item.done ? <Feather name="check" size={11} color={colors.ok} /> : null}
              </View>
              <View style={styles.ciTextWrap}>
                <Text style={[styles.ciText, item.done && styles.ciTextDone]}>{item.label}</Text>
                {item.category ? (
                  <Text style={styles.ciCategory}>{item.kind === "vendor" ? "Vendor" : "Artist"} · {item.category}</Text>
                ) : null}
              </View>
              {item.isBooked ? (
                <View style={styles.bookedBadge}>
                  <Feather name="check-circle" size={11} color={colors.ok} />
                  <Text style={styles.bookedBadgeText}>Booked</Text>
                </View>
              ) : null}
            </Pressable>

            {item.category ? (
              <View style={styles.ciMetaRow}>
                {editingAmountIndex === i ? (
                  <View style={styles.amountEditRow}>
                    <Text style={styles.amountEditPrefix}>₹</Text>
                    <TextInput
                      value={amountDraft}
                      onChangeText={(v) => setAmountDraft(v.replace(/[^0-9]/g, ""))}
                      placeholder="0"
                      placeholderTextColor={colors.textMute}
                      keyboardType="number-pad"
                      autoFocus
                      style={styles.amountEditInput}
                      onSubmitEditing={() => commitAmount(i)}
                    />
                    <Pressable style={styles.amountEditDone} onPress={() => commitAmount(i)}>
                      <Feather name="check" size={13} color="#fff" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => startEditAmount(i, item.allocatedAmount)} style={styles.allocatedPill}>
                    <Feather name="tag" size={11} color={colors.textMute} />
                    <Text style={styles.allocatedPillText}>
                      {item.allocatedAmount ? `₹${item.allocatedAmount.toLocaleString("en-IN")} allocated` : "Add budget"}
                    </Text>
                  </Pressable>
                )}
                <Pressable onPress={() => handleBookCategory(item)} style={styles.bookCta}>
                  <Text style={styles.bookCtaText}>Book {item.category}</Text>
                  <Feather name="arrow-right" size={11} color={colors.purple} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ))
      )}
      {adding ? (
        <View style={styles.addItemRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. Book anchor / MC"
            placeholderTextColor={colors.textMute}
            style={styles.addItemInput}
            autoFocus
            onSubmitEditing={handleAdd}
          />
          <Pressable style={styles.addItemDone} onPress={handleAdd}>
            <Feather name="check" size={16} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.addItemTrigger} onPress={() => setAdding(true)}>
          <Feather name="plus" size={14} color={colors.textMute} />
          <Text style={styles.addItemTriggerText}>Add checklist item</Text>
        </Pressable>
      )}
    </GlassCard>
  );
}

function CreatePlanForm({ onCreated }: { onCreated: () => void }) {
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [totalBudget, setTotalBudget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!eventName.trim() || !eventDate) return;
    setSubmitting(true);
    setError("");
    try {
      await createEventPlan({
        eventName: eventName.trim(),
        eventDate: eventDate.toISOString(),
        totalBudget: totalBudget ? Number(totalBudget) : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your event plan.");
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingScreen verticalOffset={80}>
      <ScrollView contentContainerStyle={styles.createWrap} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Feather name="calendar" size={28} color={colors.purple} style={styles.createIcon} />
        <Text style={styles.createTitle}>Planning an event?</Text>
        <Text style={styles.createSub}>
          Track your countdown, budget, and vendor checklist all in one place.
        </Text>
        <View style={styles.createField}>
          <Text style={styles.createLabel}>EVENT NAME</Text>
          <TextInput
            value={eventName}
            onChangeText={setEventName}
            placeholder="e.g. Priya & Rohan's Wedding"
            placeholderTextColor={colors.textMute}
            style={styles.createInput}
          />
        </View>
        <DateField label="EVENT DATE" value={eventDate} onChange={setEventDate} />
        <View style={styles.createField}>
          <Text style={styles.createLabel}>TOTAL BUDGET (OPTIONAL)</Text>
          <TextInput
            value={totalBudget}
            onChangeText={(v) => setTotalBudget(v.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 285000"
            placeholderTextColor={colors.textMute}
            keyboardType="number-pad"
            style={styles.createInput}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn
          label="Start planning"
          onPress={handleCreate}
          loading={submitting}
          disabled={!eventName.trim() || !eventDate}
          style={styles.createButton}
        />
      </ScrollView>
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.xl },
  topbar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  tbName: { fontFamily: fonts.display, fontWeight: "600", fontSize: 16, color: "#fff" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  skeletonGap: { marginTop: spacing.md },
  hero: { alignItems: "center", padding: spacing.lg, gap: 4 },
  heroName: { fontFamily: fonts.display, fontSize: 20, color: colors.text, textAlign: "center" },
  heroDate: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMute, letterSpacing: 0.5 },
  heroPast: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute, marginTop: spacing.sm },
  countdownRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: spacing.md },
  cdTile: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, minWidth: 56, alignItems: "center" },
  cdNum: { fontFamily: fonts.display, fontWeight: "700", fontSize: 22, color: colors.pink },
  cdLabel: { fontSize: 9, color: colors.textMute, marginTop: 2, letterSpacing: 0.5 },
  sectionTitle: { fontFamily: fonts.display, fontWeight: "600", fontSize: 15, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  budgetCard: { padding: spacing.md },
  budgetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  budgetSpent: { fontFamily: fonts.display, fontWeight: "700", fontSize: 19, color: colors.text },
  budgetSpentLabel: { fontSize: 12, color: colors.textMute, fontFamily: fonts.body },
  budgetTotal: { fontSize: 12, color: colors.textMute, fontFamily: fonts.body },
  budgetBarTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)", marginTop: spacing.sm, overflow: "hidden" },
  budgetBarFill: { height: "100%", borderRadius: 4, backgroundColor: colors.pink },
  budgetCats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm },
  budgetChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  budgetChipText: { fontSize: 10.5, color: colors.textDim, fontFamily: fonts.body },
  checklistCard: { padding: spacing.md, gap: 2 },
  checklistEmpty: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute, paddingVertical: spacing.sm },
  checklistItemWrap: { borderBottomWidth: 1, borderBottomColor: colors.line },
  checklistItem: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11 },
  cb: { width: 21, height: 21, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  cbDone: { backgroundColor: "rgba(34,197,94,0.16)" },
  cbPending: { borderWidth: 1.5, borderColor: colors.line },
  ciTextWrap: { flex: 1, gap: 2 },
  ciText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  ciTextDone: { color: colors.textMute, textDecorationLine: "line-through" },
  ciCategory: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMute },
  bookedBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: "rgba(34,197,94,0.12)" },
  bookedBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.ok },
  ciMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingLeft: 32, paddingBottom: 10 },
  allocatedPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.line },
  allocatedPillText: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  amountEditRow: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 4 },
  amountEditPrefix: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
  amountEditInput: { minWidth: 60, fontFamily: fonts.body, fontSize: 12.5, color: colors.text, paddingVertical: 2 },
  amountEditDone: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" },
  bookCta: { flexDirection: "row", alignItems: "center", gap: 4 },
  bookCtaText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.purple },
  allocatedRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  allocatedRowText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMute },
  remainingOk: { color: colors.textDim },
  remainingOver: { color: colors.err },
  addItemRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: spacing.sm },
  addItemInput: { flex: 1, backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 9, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  addItemDone: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" },
  addItemTrigger: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: spacing.sm },
  addItemTriggerText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute },
  addVendorCta: { marginTop: spacing.lg, paddingVertical: 14, borderRadius: 16, alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  addVendorCtaText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.textDim },
  multiPlanHint: { textAlign: "center", fontFamily: fonts.body, fontSize: 11.5, color: colors.textMute, marginTop: spacing.md },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textMute, textAlign: "center" },
  retryButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.pink },
  retryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.pink },
  createWrap: { flexGrow: 1, padding: spacing.xl, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  createIcon: { marginBottom: spacing.xs },
  createTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.text, textAlign: "center" },
  createSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMute, textAlign: "center", lineHeight: 18, marginBottom: spacing.md },
  createField: { width: "100%", gap: 4, marginBottom: spacing.sm },
  createLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5 },
  createInput: { backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 14, color: colors.text },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.err, alignSelf: "flex-start" },
  createButton: { width: "100%", marginTop: spacing.sm },
});

const pickerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.ink2,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    maxHeight: "75%",
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  sheetTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
  kindRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md },
  kindOption: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
  },
  kindOptionText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  list: { maxHeight: 380 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionEmoji: { fontSize: 16 },
  optionText: { fontFamily: fonts.body, fontSize: 14.5, color: colors.text },
});
