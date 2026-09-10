import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { GradientButton } from "@/components/GradientButton";
import { GlassCard } from "@/components/GlassCard";
import { DateField } from "@/components/DateField";
import { KeyboardAvoidingScreen } from "@/components/KeyboardAvoidingScreen";
import { ApiError, createQuoteRequest, QUOTE_CATEGORIES, type QuoteRequestLineItemInput } from "@/lib/api";
import { colors, fonts, radii, spacing } from "@/theme";

const EVENT_TYPES = ["Wedding", "Corporate Event", "Birthday Party", "Private Party", "Festival / Concert", "Other"];

type DraftLineItem = QuoteRequestLineItemInput & { key: string };

function newLineItem(): DraftLineItem {
  return { key: `${Date.now()}-${Math.random()}`, category: "", genre: "", quantity: 1, notes: "" };
}

export default function NewQuoteRequestScreen() {
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [eventCity, setEventCity] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([newLineItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateLineItem(key: string, patch: Partial<DraftLineItem>) {
    setLineItems((items) => items.map((li) => (li.key === key ? { ...li, ...patch } : li)));
  }

  function removeLineItem(key: string) {
    setLineItems((items) => (items.length > 1 ? items.filter((li) => li.key !== key) : items));
  }

  const canSubmit =
    eventName.trim().length > 1 &&
    Boolean(eventDate) &&
    eventCity.trim().length > 1 &&
    lineItems.every((li) => li.category.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || !eventDate) return;
    setSaving(true);
    setError("");
    try {
      const res = await createQuoteRequest({
        eventName: eventName.trim(),
        eventType,
        eventDate: eventDate.toISOString(),
        eventCity: eventCity.trim(),
        budgetMin: budgetMin ? Number(budgetMin) : undefined,
        budgetMax: budgetMax ? Number(budgetMax) : undefined,
        lineItems: lineItems.map(({ key, ...li }) => ({
          category: li.category,
          genre: li.genre?.trim() || undefined,
          quantity: li.quantity ?? 1,
          notes: li.notes?.trim() || undefined,
        })),
      });
      router.replace({ pathname: "/quote-requests/[id]", params: { id: res.quoteRequest.id } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the request. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <KeyboardAvoidingScreen>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Event details</Text>

            <Text style={styles.fieldLabel}>EVENT NAME</Text>
            <TextInput
              value={eventName}
              onChangeText={setEventName}
              placeholder="e.g. Priya & Rohan's Wedding"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>OCCASION</Text>
            <View style={styles.pillRow}>
              {EVENT_TYPES.map((t) => (
                <Pressable key={t} style={[styles.pill, eventType === t && styles.pillSelected]} onPress={() => setEventType(t)}>
                  <Text style={[styles.pillText, eventType === t && styles.pillTextSelected]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <DateField label="EVENT DATE" value={eventDate} onChange={setEventDate} />

            <Text style={styles.fieldLabel}>CITY</Text>
            <TextInput
              value={eventCity}
              onChangeText={setEventCity}
              placeholder="e.g. Mumbai"
              placeholderTextColor={colors.textMute}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>BUDGET (OPTIONAL, VISIBLE TO ARTISTS)</Text>
            <View style={styles.budgetRow}>
              <TextInput
                value={budgetMin}
                onChangeText={setBudgetMin}
                placeholder="Min ₹"
                placeholderTextColor={colors.textMute}
                keyboardType="number-pad"
                style={[styles.input, styles.budgetInput]}
              />
              <TextInput
                value={budgetMax}
                onChangeText={setBudgetMax}
                placeholder="Max ₹"
                placeholderTextColor={colors.textMute}
                keyboardType="number-pad"
                style={[styles.input, styles.budgetInput]}
              />
            </View>

            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitle}>Who do you need?</Text>
              <Pressable onPress={() => setLineItems((items) => [...items, newLineItem()])} hitSlop={8}>
                <Feather name="plus-circle" size={20} color={colors.purple} />
              </Pressable>
            </View>

            {lineItems.map((li, idx) => (
              <GlassCard key={li.key} style={styles.lineItemCard}>
                <View style={styles.lineItemHeadRow}>
                  <Text style={styles.lineItemLabel}>Need #{idx + 1}</Text>
                  {lineItems.length > 1 ? (
                    <Pressable onPress={() => removeLineItem(li.key)} hitSlop={8}>
                      <Feather name="trash-2" size={15} color={colors.err} />
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.pillRow}>
                  {QUOTE_CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      style={[styles.pillSmall, li.category === cat && styles.pillSelected]}
                      onPress={() => updateLineItem(li.key, { category: cat })}
                    >
                      <Text style={[styles.pillTextSmall, li.category === cat && styles.pillTextSelected]}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.rowGap}>
                  <TextInput
                    value={li.genre}
                    onChangeText={(v) => updateLineItem(li.key, { genre: v })}
                    placeholder="Genre (optional, e.g. Bollywood)"
                    placeholderTextColor={colors.textMute}
                    style={[styles.input, styles.flex1]}
                  />
                  <View style={styles.qtyStepper}>
                    <Pressable onPress={() => updateLineItem(li.key, { quantity: Math.max(1, (li.quantity ?? 1) - 1) })} style={styles.qtyBtn}>
                      <Feather name="minus" size={14} color={colors.text} />
                    </Pressable>
                    <Text style={styles.qtyText}>{li.quantity ?? 1}</Text>
                    <Pressable onPress={() => updateLineItem(li.key, { quantity: Math.min(20, (li.quantity ?? 1) + 1) })} style={styles.qtyBtn}>
                      <Feather name="plus" size={14} color={colors.text} />
                    </Pressable>
                  </View>
                </View>

                <TextInput
                  value={li.notes}
                  onChangeText={(v) => updateLineItem(li.key, { notes: v })}
                  placeholder="Notes for this need (optional)"
                  placeholderTextColor={colors.textMute}
                  style={styles.input}
                  multiline
                />
              </GlassCard>
            ))}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <GradientButton label="Send quote request" onPress={handleSubmit} disabled={!canSubmit} loading={saving} style={styles.submitButton} />
          </ScrollView>
        </KeyboardAvoidingScreen>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xs },
  sectionTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.text, marginTop: spacing.sm, marginBottom: 2 },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5, marginTop: spacing.sm },
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
  flex1: { flex: 1 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink2 },
  pillSmall: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink },
  pillSelected: { borderColor: colors.purple, backgroundColor: "rgba(168,85,247,0.18)" },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.textDim },
  pillTextSmall: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.textDim },
  pillTextSelected: { color: "#fff" },
  budgetRow: { flexDirection: "row", gap: spacing.sm },
  budgetInput: { flex: 1 },
  lineItemCard: { gap: spacing.xs, marginTop: spacing.sm },
  lineItemHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lineItemLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  rowGap: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  qtyStepper: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.ink2, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 8 },
  qtyBtn: { padding: 2 },
  qtyText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text, minWidth: 16, textAlign: "center" },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.err, marginTop: spacing.sm },
  submitButton: { marginTop: spacing.lg },
});
