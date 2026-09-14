import "server-only";

import { env } from "@/lib/env";

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  if (!env.resendApiKey || !env.emailFrom) {
    if (env.isProduction) throw new Error("Email delivery is not configured.");
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [email],
      subject: "Verify your Surviver.lol email",
      text: `Verify your email: ${env.appUrl}/verify-email/${token}\n\nThis link expires in one hour.`,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Email delivery failed (${response.status}).`);
}
