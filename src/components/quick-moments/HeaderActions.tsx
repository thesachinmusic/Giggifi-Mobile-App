import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { HomeCityControl } from "@/components/HomeCityControl";
import { NotificationBell } from "@/components/NotificationBell";
import { getHomeCity, setHomeCity } from "@/lib/home-city-storage";
import { captureError } from "@/lib/telemetry";
import { spacing } from "@/theme";

// Top-right of the Quick Moments app bar: the same city control and
// notification bell Home has, sharing Home's stored city.
export function QuickMomentsHeaderActions() {
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHomeCity()
      .then((stored) => {
        if (!cancelled) setCity(stored);
      })
      .catch((err) => captureError(err, "quick-moments-header-city"));
    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(next: string) {
    setCity(next);
    setHomeCity(next).catch((err) => captureError(err, "quick-moments-header-city-persist"));
  }

  return (
    <View style={styles.row}>
      <HomeCityControl city={city} onChange={handleChange} />
      <NotificationBell />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
