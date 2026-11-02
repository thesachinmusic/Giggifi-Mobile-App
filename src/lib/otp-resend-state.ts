// Resend counters for the phone OTP sheet, kept outside the component so
// closing and reopening the sheet can't be used to dodge the cooldown or the
// resend cap. In memory only: the backend's own hourly limit is the real
// guard, and a fresh app start is a fresh state.
export const RESEND_COOLDOWNS_SECONDS = [30, 60, 120];
export const MAX_RESENDS = RESEND_COOLDOWNS_SECONDS.length;
// Matches the backend's per-phone window (10 per hour).
const STATE_TTL_MS = 60 * 60 * 1000;

interface ResendState {
  resendCount: number;
  cooldownUntil: number;
  updatedAt: number;
}

const states = new Map<string, ResendState>();

export function getResendState(phone: string, now = Date.now()): ResendState | null {
  const s = states.get(phone);
  if (!s) return null;
  if (now - s.updatedAt > STATE_TTL_MS) {
    states.delete(phone);
    return null;
  }
  return s;
}

export function remainingCooldownSeconds(phone: string, now = Date.now()): number {
  const s = getResendState(phone, now);
  return s ? Math.max(0, Math.ceil((s.cooldownUntil - now) / 1000)) : 0;
}

// First OTP sent for this phone: no cooldown yet (same as before), but the
// phone is now known, so a reopened sheet won't send a second code.
export function recordFirstSend(phone: string, now = Date.now()): void {
  if (!getResendState(phone, now)) states.set(phone, { resendCount: 0, cooldownUntil: 0, updatedAt: now });
}

export function recordResend(phone: string, now = Date.now()): void {
  const count = getResendState(phone, now)?.resendCount ?? 0;
  const cooldown = RESEND_COOLDOWNS_SECONDS[Math.min(count, MAX_RESENDS - 1)];
  states.set(phone, { resendCount: count + 1, cooldownUntil: now + cooldown * 1000, updatedAt: now });
}

export function clearResendState(phone: string): void {
  states.delete(phone);
}

export function resetAllResendStates(): void {
  states.clear();
}
