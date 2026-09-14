"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { randomBytes } from "node:crypto";
import { createSession, destroySession } from "@/lib/auth/session";
import { fakeVerify, hashPassword, passwordFitsBcrypt, verifyPassword } from "@/lib/auth/password";
import { verifyAdminMfa } from "@/lib/auth/mfa";
import { sendVerificationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { consumeRateLimit, requestIp } from "@/lib/security/request";
import { hashCapability } from "@/lib/security/tokens";
import { safeNextPath } from "@/lib/auth/redirects";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "name" | "mfaCode", string>>;
};

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("That does not look like an email address.")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .refine(passwordFitsBcrypt, "Use a password no longer than 72 UTF-8 bytes.");

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Your name is required.").max(80),
  email: emailSchema,
  password: passwordSchema,
});

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").refine(passwordFitsBcrypt, "Email or password is incorrect."),
  mfaCode: z.string().trim().max(12).optional(),
});

function fieldErrorsFrom(error: z.ZodError): AuthFormState["fieldErrors"] {
  const out: AuthFormState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === "email" || key === "password" || key === "name" || key === "mfaCode") {
      out[key] ??= issue.message;
    }
  }
  return out;
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { name, email, password } = parsed.data;
  const ip = await requestIp();
  if (!(await consumeRateLimit("signup-ip", ip, 5, 60 * 60_000)) || !(await consumeRateLimit("signup-email", email, 3, 60 * 60_000))) {
    return { error: "Too many attempts. Please try again later." };
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { error: "We could not create that account. Try signing in or request a new verification email." };
  }

  const verificationToken = randomBytes(32).toString("base64url");
  const user = await prisma.user.create({
    data: {
      name, email, passwordHash: await hashPassword(password),
      ...(env.isProduction ? {
        emailVerificationTokenHash: hashCapability(verificationToken),
        emailVerificationExpiresAt: new Date(Date.now() + 60 * 60_000),
      } : { emailVerifiedAt: new Date() }),
    },
    select: { id: true },
  });

  if (env.isProduction) {
    await sendVerificationEmail(email, verificationToken);
    redirect("/verify-email?sent=1");
  }
  await createSession(user.id);
  redirect(safeNextPath(formData.get("next")));
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    mfaCode: formData.get("mfaCode") ?? undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { email, password } = parsed.data;
  const ip = await requestIp();
  if (!(await consumeRateLimit("signin-ip", ip, 12, 15 * 60_000)) || !(await consumeRateLimit("signin-email", email, 8, 15 * 60_000))) {
    return { error: "Too many attempts. Please try again later." };
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, emailVerifiedAt: true, role: true },
  });

  // Same message and comparable timing either way, so this cannot be used to
  // discover which email addresses have accounts. A guest founder who entered a
  // season without signing up has no password hash and cannot log in at all,
  // which must look identical to an unknown address.
  if (!user?.passwordHash) {
    await fakeVerify();
    return { error: "Email or password is incorrect." };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password is incorrect." };
  }

  if (!user.emailVerifiedAt) return { error: "Verify your email before signing in." };
  if (user.role === "ADMIN" && !(await verifyAdminMfa(parsed.data.mfaCode ?? ""))) {
    return { fieldErrors: { mfaCode: "Enter a valid administrator verification code." } };
  }

  await createSession(user.id);
  redirect(safeNextPath(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
