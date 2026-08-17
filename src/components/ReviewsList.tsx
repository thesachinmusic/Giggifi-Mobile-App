import { StyleSheet, Text, View } from "react-native";
import { RatingBadge } from "@/components/RatingBadge";
import type { ReviewSummary } from "@/lib/api";
import { colors, fonts, radii, spacing } from "@/theme";

// Shared between artist/[id].tsx and vendor/[id].tsx — recentReviews is
// already returned by both mobile detail endpoints (up to 5, per review
// route.ts on the website) but was rendered nowhere until now.
export function ReviewsList({ reviews }: { reviews: ReviewSummary[] }) {
  if (reviews.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.label}>REVIEWS</Text>
      {reviews.map((review, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.header}>
            <RatingBadge rating={review.rating} size={12} />
            {review.eventType ? <Text style={styles.eventType} numberOfLines={1}>{review.eventType}</Text> : null}
            <Text style={styles.date}>
              {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
          {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.lg, gap: spacing.sm },
  label: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMute, letterSpacing: 0.5, marginBottom: 2 },
  card: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 6,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  eventType: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 9.5,
    color: colors.textMute,
    textTransform: "uppercase",
  },
  date: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.textMute },
  comment: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim },
});
