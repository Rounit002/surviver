"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { consumeRateLimit, requestIp } from "@/lib/security/request";
import { hashCapability } from "@/lib/security/tokens";

export type VerificationState = { message?: string; error?: string };

export async function resendVerificationAction(
  _previous: VerificationState,
  formData: FormData,
): Promise<VerificationState> {
  const parsed = z.string().trim().email().max(254).safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const email = parsed.data.toLowerCase();
  const ip = await requestIp();
  if (!(await consumeRateLimit("verify-email-ip", ip, 5, 60 * 60_000)) || !(await consumeRateLimit("verify-email-address", email, 3, 60 * 60_000))) {
    return { message: "If that account can be verified, a message will arrive shortly." };
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });
  if (user && !user.emailVerifiedAt) {
    const token = randomBytes(32).toString("base64url");
    await prisma.user.update({ where: { id: user.id }, data: {
      emailVerificationTokenHash: hashCapability(token),
      emailVerificationExpiresAt: new Date(Date.now() + 60 * 60_000),
    } });
    await sendVerificationEmail(email, token);
  }
  return { message: "If that account can be verified, a message will arrive shortly." };
}
