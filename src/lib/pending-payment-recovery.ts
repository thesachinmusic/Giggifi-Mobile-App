import { verifyRazorpayPayment } from "@/lib/api";
import { clearPendingPayment, getPendingPayment, type PendingPayment } from "@/lib/pending-payment-storage";

// Re-attempts the original verify call for whatever payment got stuck
// (Razorpay succeeded, but the app never heard back). Shared by: the booking
// screen's own retry-on-focus, the immediate retry right after a failed
// verify, and the app-wide retry-on-foreground in the root layout — so
// there's exactly one place that knows how to resolve a stuck payment.
export async function recoverPendingPayment(): Promise<{ resolved: boolean; pending: PendingPayment | null }> {
  const pending = await getPendingPayment();
  if (!pending) return { resolved: false, pending: null };

  try {
    await verifyRazorpayPayment({
      bookingId: pending.bookingId,
      razorpay_order_id: pending.razorpayOrderId,
      razorpay_payment_id: pending.razorpayPaymentId,
      razorpay_signature: pending.razorpaySignature,
    });
    await clearPendingPayment();
    return { resolved: true, pending };
  } catch {
    // Still stuck — leave it stored, the next foreground/focus will retry.
    return { resolved: false, pending };
  }
}
