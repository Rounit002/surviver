import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { hashCapability } from "@/lib/security/tokens";

export async function GET(request: Request, ctx: RouteContext<"/verify-email/[token]">) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) return NextResponse.redirect(new URL("/verify-email?invalid=1", request.url));
  const now = new Date();
  const user = await prisma.user.findFirst({ where: {
    emailVerificationTokenHash: hashCapability(token),
    emailVerificationExpiresAt: { gt: now },
    emailVerifiedAt: null,
  }, select: { id: true } });
  if (!user) return NextResponse.redirect(new URL("/verify-email?invalid=1", request.url));
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: {
      emailVerifiedAt: now,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await createSession(user.id);
  return NextResponse.redirect(new URL("/dashboard?verified=1", request.url));
}
