import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { Skeleton } from "@/components/Skeleton";
import { fetchMyEnquiries } from "@/lib/api";
import { dateText, replyCountText, sentToText, statusText, type MyEnquiry } from "@/lib/my-enquiries";
import { captureError } from "@/lib/telemetry";
import { colors, fonts, radii, spacing } from "@/theme";

// The enquiries you sent, and how many replies each has. View only.
export default function MyEnquiriesScreen() {
  const [items, setItems] = useState<MyEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    fetchMyEnquiries()
      .then(({ enquiries }) => setItems(enquiries))
      .catch((err) => {
        captureError(err, "my-enquiries-fetch");
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {loading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={88} borderRadius={radii.xl} />
            ))}
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.muted}>Could not load your enquiries. Check your internet connection and try again.</Text>
            <Pressable style={styles.retry} onPress={() => { setLoading(true); load(); }} accessibilityRole="button">
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Feather name="message-square" size={22} color={colors.textMute} />
                <Text style={styles.muted}>No enquiries yet. When you send an enquiry to an artist or a vendor, it shows up here with their replies.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.card}
                onPress={() => router.push({ pathname: "/my-enquiry", params: { id: item.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${item.eventType} enquiry, ${replyCountText(item.replyCount)}`}
              >
                <View style={styles.row}>
                  <Text style={styles.title}>{item.eventType}</Text>
                  <Text style={[styles.badge, item.replyCount > 0 ? styles.badgeOn : null]}>{replyCountText(item.replyCount)}</Text>
                </View>
                <Text style={styles.sub}>{`${item.city} · ${dateText(item.eventDate)} · ${statusText(item.status)}`}</Text>
                <Text style={styles.sub}>{sentToText(item)}</Text>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, gap: spacing.sm },
  muted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMute, textAlign: "center" },
  retry: { marginTop: spacing.md, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line },
  retryText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  card: { borderRadius: radii.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(255,255,255,0.04)", padding: spacing.md, gap: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 17, color: colors.text },
  badge: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.textMute },
  badgeOn: { color: colors.pink },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textDim },
});
