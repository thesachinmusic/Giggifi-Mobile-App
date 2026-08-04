import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const PENDING_PAYMENT_KEY = "giggifi_pending_payment";

export interface PendingPayment {
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

// Mirrors auth-storage.ts's SecureStore/localStorage split — same reason:
// expo-secure-store's web shim isn't reliable on this SDK version.
// Holds at most one pending payment. A user has one checkout in flight at a
// time in practice; storing a single slot keeps recovery simple, and it's
// always cleared the moment verification actually succeeds.
export async function getPendingPayment(): Promise<PendingPayment | null> {
  const raw =
    Platform.OS === "web"
      ? typeof localStorage === "undefined" ? null : localStorage.getItem(PENDING_PAYMENT_KEY)
      : await SecureStore.getItemAsync(PENDING_PAYMENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingPayment;
  } catch {
    return null;
  }
}

export async function setPendingPayment(payment: PendingPayment): Promise<void> {
  const raw = JSON.stringify(payment);
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(PENDING_PAYMENT_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(PENDING_PAYMENT_KEY, raw);
}

export async function clearPendingPayment(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(PENDING_PAYMENT_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(PENDING_PAYMENT_KEY);
}
