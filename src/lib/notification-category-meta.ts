import { Feather } from "@expo/vector-icons";
import { colors } from "@/theme";
import type { NotificationCategory } from "./api";

export const CATEGORY_META: Record<NotificationCategory, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
  BOOKING: { icon: "calendar", color: colors.purple, label: "Bookings" },
  PAYMENT: { icon: "credit-card", color: colors.pink, label: "Payments" },
  EVENT_DAY: { icon: "music", color: colors.gold, label: "Event day" },
  SECURITY: { icon: "shield", color: colors.err, label: "Security" },
  SUPPORT: { icon: "life-buoy", color: colors.orange, label: "Support" },
  OFFER: { icon: "tag", color: colors.textMute, label: "Offers" },
};
