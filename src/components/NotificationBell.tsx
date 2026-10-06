import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useNotifications } from "@/lib/notifications-context";
import { colors, fonts } from "@/theme";

export function NotificationBell() {
  const { unreadCount } = useNotifications();

  return (
    <Pressable
      style={styles.button}
      onPress={() => router.push("/notifications")}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
    >
      <Feather name="bell" size={18} color={colors.text} />
      {unreadCount > 0 ? (
        <View style={styles.dot}>
          <Text style={styles.dotText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF3D7F",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  dotText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: "#fff",
  },
});
