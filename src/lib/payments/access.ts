import "server-only";

import { safeEqual, hashCapability } from "@/lib/security/tokens";

export function hasCheckoutCapability(
  token: string | undefined,
  payment: { checkoutTokenHash: string | null; checkoutTokenExpiresAt: Date | null },
): boolean {
  if (!token || token.length > 128 || !payment.checkoutTokenHash || !payment.checkoutTokenExpiresAt || payment.checkoutTokenExpiresAt <= new Date()) return false;
  return safeEqual(hashCapability(token), payment.checkoutTokenHash);
}
