import "server-only";

import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

/**
 * Route guards. Roles are checked on the server on every request; nothing about
 * the visible UI is load bearing for access.
 */

export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${next}`);
  }
  return user;
}

export { getSessionUser };
export type { SessionUser };
