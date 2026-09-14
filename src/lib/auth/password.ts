import bcrypt from "bcryptjs";

const ROUNDS = 12;
export const BCRYPT_MAX_BYTES = 72;

export function passwordFitsBcrypt(plain: string): boolean {
  return Buffer.byteLength(plain, "utf8") <= BCRYPT_MAX_BYTES;
}

export async function hashPassword(plain: string): Promise<string> {
  if (!passwordFitsBcrypt(plain)) throw new Error("Password exceeds bcrypt's byte limit.");
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!passwordFitsBcrypt(plain)) return false;
  return bcrypt.compare(plain, hash);
}

/**
 * Compares against a throwaway hash so a login attempt for an unknown email
 * costs the same time as one for a real account. Without this, response timing
 * leaks which addresses are registered.
 */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO1B7YQ0YQx1yZ0PxKQ0PxKQ0PxKQ0PxK";

export async function fakeVerify(): Promise<void> {
  await bcrypt.compare("surviver-timing-equaliser", DUMMY_HASH).catch(() => false);
}
