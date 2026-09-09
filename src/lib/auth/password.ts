import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
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
