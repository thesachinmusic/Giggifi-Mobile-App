import { Linking, Platform } from "react-native";
import * as Device from "expo-device";

export interface OemGuidance {
  brand: string;
  instructions: string[];
}

// Xiaomi/MIUI, Oppo/ColorOS, Vivo/FunTouch, Realme and OnePlus aggressively
// kill background processes and silently swallow push notifications — a
// large share of Indian Android users. There's no reliable one-tap deep
// link into these OEMs' proprietary "Autostart" screens (see the comment
// on openBatteryOptimizationSettings below for why), so this ships as
// written guidance instead of a magic fix.
const OEM_GUIDANCE: Record<string, OemGuidance> = {
  xiaomi: {
    brand: "Xiaomi",
    instructions: [
      "Settings → Apps → Manage apps → GiggiFi → Autostart → turn on",
      "Settings → Battery & performance → App battery saver → GiggiFi → No restrictions",
    ],
  },
  oppo: {
    brand: "Oppo",
    instructions: [
      "Settings → Battery → App Battery Management → GiggiFi → Allow background activity",
      "Settings → Privacy Permissions → Startup Manager → turn on GiggiFi",
    ],
  },
  vivo: {
    brand: "Vivo",
    instructions: [
      "Settings → Battery → Background Power Consumption Management → GiggiFi → allow",
      "Settings → More Settings → Applications → Autostart → turn on GiggiFi",
    ],
  },
  realme: {
    brand: "Realme",
    instructions: [
      "Settings → Battery → App Battery Management → GiggiFi → Allow background activity",
      "Settings → App Management → Startup Manager → turn on GiggiFi",
    ],
  },
  oneplus: {
    brand: "OnePlus",
    instructions: [
      "Settings → Battery → Battery optimization → GiggiFi → Don't optimize",
      "Settings → Apps → App Management → Autostart Manager → turn on GiggiFi",
    ],
  },
};

export function getOemGuidance(): OemGuidance | null {
  if (Platform.OS !== "android") return null;
  const manufacturer = Device.manufacturer?.toLowerCase() ?? "";
  const match = Object.keys(OEM_GUIDANCE).find((key) => manufacturer.includes(key));
  return match ? OEM_GUIDANCE[match] : null;
}

// Opens the battery-optimization LIST screen (android.settings.
// IGNORE_BATTERY_OPTIMIZATION_SETTINGS) — any app can invoke this, no
// special permission needed. The direct per-app "Don't optimize?" dialog
// (ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, the permission declared in
// app.json) needs the Intent's `data` set to a "package:<name>" Uri, which
// RN's public Linking.sendIntent(action, extras) has no way to set — it
// only supports action + key/value extras, not intent data. The list
// screen is the closest reliably reachable target through that API.
export async function openBatteryOptimizationSettings(): Promise<void> {
  try {
    await Linking.sendIntent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
  } catch {
    await Linking.openSettings();
  }
}
