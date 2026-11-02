import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { ApiError, fetchEnquiryReplies } from "@/lib/api";
import { dateText, kindText, priceText, replyCountText, statusText, type EnquiryReplies } from "@/lib/my-enquiries";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

// The replies to one of your enquiries: who replied, the price if they gave one, and their message. View only.
export default function MyEnquiryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<EnquiryReplies | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    fetchEnquiryReplies(String(id))
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) return setError("This enquiry was not found.");
        captureError(err, "my-enquiry-replies-fetch");
        setError("Could not load the replies. Check your internet connection and try again.");
      });
  }, [id]);
  useFocusEffect(load);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {!data && !error ? <ActivityIndicator color={colors.pink} style={{ marginTop: 30 }} /> : null}
          {error ? (
            <View style={styles.centered}>
              <Text style={styles.muted}>{error}</Text>
              <Pressable style={styles.retry} onPress={load} accessibilityRole="button">
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
          {data ? (
            <>
              <Text style={styles.title}>{data.enquiry.eventType}</Text>
              <Text style={styles.sub}>{`${data.enquiry.city} · ${dateText(data.enquiry.eventDate)} · ${statusText(data.enquiry.status)}`}</Text>
              <Text style={[styles.sub, { marginTop: 4, marginBottom: spacing.md }]}>{replyCountText(data.replies.length)}</Text>

              {data.replies.length === 0 ? (
                <Text style={styles.muted}>No replies yet. We will tell you when someone replies.</Text>
              ) : null}

              {data.replies.map((r) => (
                <View key={r.id} style={styles.card}>
                  <View style={styles.row}>
                    {r.imageUrl ? <Image source={{ uri: r.imageUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarEmpty]} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{r.name}</Text>
                      <Text style={styles.sub}>{[kindText(r.kind), r.city].filter(Boolean).join(" · ")}</Text>
                    </View>
                    <Text style={[styles.price, !r.quoteAmount ? styles.priceNone : null]}>{priceText(r.quoteAmount)}</Text>
                  </View>
                  <Text style={styles.message}>{r.message}</Text>
                  <Text style={styles.date}>{dateText(r.createdAt)}</Text>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  centered: { alignItems: "center", paddingTop: spacing.xxl, gap: spacing.sm },
  muted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMute, textAlign: "center" },
  retry: { marginTop: spacing.md, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textDim },
  card: { borderRadius: radii.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(255,255,255,0.04)", padding: spacing.md, marginBottom: spacing.sm, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarEmpty: { backgroundColor: "rgba(255,255,255,0.08)" },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 15.5, color: colors.text },
  price: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
  priceNone: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMute },
  message: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.textDim },
  date: { fontFamily: fonts.body, fontSize: 12, color: colors.textMute },
});
