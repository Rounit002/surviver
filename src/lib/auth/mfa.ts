import "server-only";

import { verify } from "otplib";
import { env } from "@/lib/env";

export async function verifyAdminMfa(token: string): Promise<boolean> {
  const secret = env.adminTotpSecret;
  if (!secret || !/^\d{6}$/.test(token)) return false;
  try {
    return (await verify({ secret, token })).valid;
  } catch {
    return false;
  }
}
