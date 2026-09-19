"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth/session";
import { fakeVerify, hashPassword, passwordFitsBcrypt, verifyPassword } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/redirects";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "name", string>>;
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
});

function fieldErrorsFrom(error: z.ZodError): AuthFormState["fieldErrors"] {
  const out: AuthFormState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === "email" || key === "password" || key === "name") {
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
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { error: "We could not create that account. Try signing in instead." };
  }

  const user = await prisma.user.create({
    data: {
      name, email, passwordHash: await hashPassword(password),
      // Email is the login identifier; signup does not depend on a mail
      // provider or an out-of-band verification step.
    },
    select: { id: true },
  });

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
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
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

  await createSession(user.id);
  redirect(safeNextPath(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
