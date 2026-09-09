"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { CATEGORY_VALUES, PENDING_PAYMENT_COOKIE } from "@/lib/competition/constants";
import { getOpenSeason, CLAIMED_ENTRY_STATUSES } from "@/lib/competition/season";
import { lockSeason } from "@/lib/competition/engine";
import { getPaymentProvider } from "@/lib/payments";
import { fetchSiteMetadata, normalizeUrl, UnsafeUrlError } from "@/lib/products/site-metadata";
import type { ProductCategory } from "@/generated/prisma";

/* -------------------------------------------------------------------------- */
/* Prefill                                                                     */
/* -------------------------------------------------------------------------- */

export type LookupResult = {
  ok: boolean;
  error?: string;
  url?: string;
  name?: string;
  description?: string;
  imageUrl?: string | null;
  faviconUrl?: string | null;
};

/**
 * Reads a submitted site so the founder does not have to retype what is already
 * on their homepage. Open to anyone, because entering requires no account.
 */
export async function lookupSiteAction(rawUrl: string): Promise<LookupResult> {
  try {
    const metadata = await fetchSiteMetadata(rawUrl);
    return {
      ok: true,
      url: metadata.url,
      name: metadata.title?.slice(0, 60) ?? undefined,
      description: metadata.description?.slice(0, 400) ?? undefined,
      imageUrl: metadata.imageUrl,
      faviconUrl: metadata.faviconUrl,
    };
  } catch (error) {
    if (error instanceof UnsafeUrlError) return { ok: false, error: error.message };
    console.error("[surviver] site lookup failed", error);
    return { ok: false, error: "We could not read that site. Fill the details in by hand." };
  }
}

/* -------------------------------------------------------------------------- */
/* Entry                                                                       */
/* -------------------------------------------------------------------------- */

type EntryField =
  | "url"
  | "name"
  | "tagline"
  | "description"
  | "category"
  | "email"
  | "rules";

export type EntryFormState = {
  error?: string;
  fieldErrors?: Partial<Record<EntryField, string>>;
};

const VALIDATED_FIELDS: EntryField[] = [
  "url",
  "name",
  "tagline",
  "description",
  "category",
  "email",
];

const entrySchema = z.object({
  url: z.string().min(1, "Enter your product URL."),
  name: z
    .string()
    .trim()
    .min(2, "Enter a product name.")
    .max(60, "Keep the name under 60 characters."),
  tagline: z
    .string()
    .trim()
    .min(10, "Write a short tagline.")
    .max(90, "Keep the tagline under 90 characters."),
  description: z
    .string()
    .trim()
    .min(40, "Describe what it does in a sentence or two.")
    .max(400, "Keep the description under 400 characters."),
  category: z.enum(CATEGORY_VALUES as [ProductCategory, ...ProductCategory[]], {
    message: "Choose a category.",
  }),
  // The only personal detail asked for: identifies ownership of the entry.
  email: z
    .string()
    .trim()
    .min(1, "Enter an email for your private campaign link.")
    .email("That does not look like an email address.")
    .transform((value) => value.toLowerCase()),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function createEntryAction(
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  if (formData.get("rules") !== "on") {
    return { fieldErrors: { rules: "You need to accept the rules before entering." } };
  }

  const parsed = entrySchema.safeParse({
    url: formData.get("url"),
    name: formData.get("name"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    category: formData.get("category"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<EntryField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && (VALIDATED_FIELDS as string[]).includes(key)) {
        fieldErrors[key as EntryField] ??= issue.message;
      }
    }
    return { fieldErrors };
  }

  let url: string;
  try {
    url = normalizeUrl(parsed.data.url);
  } catch (error) {
    return {
      fieldErrors: { url: error instanceof UnsafeUrlError ? error.message : "Invalid URL." },
    };
  }

  const provider = getPaymentProvider();
  const season = await getOpenSeason();
  if (!season) return { error: "No season is taking entries right now." };
  const { name, tagline, description, category, email } = parsed.data;
  const slug = `${slugify(name) || "product"}-${randomBytes(6).toString("hex")}`;
  const result = await prisma.$transaction(async tx => {
    await lockSeason(tx, season.id);
    const current = await tx.season.findUniqueOrThrow({ where: { id: season.id } });
    const now = new Date();
    if (current.status !== "REGISTRATION_OPEN" || (current.registrationStart && current.registrationStart > now) || (current.registrationEnd && current.registrationEnd <= now)) return { error: "Registration has closed." };
    const claimed = await tx.seasonEntry.count({ where: { seasonId: season.id, status: { in: CLAIMED_ENTRY_STATUSES } } });
    if (claimed >= current.capacity) return { error: "This season is full." };
    const duplicate = await tx.seasonEntry.findFirst({ where: { seasonId: season.id, product: { url }, status: { notIn: ["REJECTED", "WITHDRAWN"] } } });
    if (duplicate) return { error: "That URL already has an entry. Use your original checkout or private campaign link." };
    const owner = await tx.user.upsert({ where: { email }, update: {}, create: { email, name }, select: { id: true } });
    const product = await tx.product.create({ data: { ownerId: owner.id, name, slug, url, tagline, description, category, logoUrl: asOptionalUrl(formData.get("faviconUrl")), coverUrl: asOptionalUrl(formData.get("imageUrl")), approvalStatus: "DRAFT" } });
    const entry = await tx.seasonEntry.create({ data: { seasonId: season.id, productId: product.id, status: "AWAITING_PAYMENT", rallyCode: `${slugify(name).slice(0, 12) || "entry"}-${randomBytes(6).toString("hex")}`, manageToken: randomBytes(24).toString("base64url") } });
    const payment = await tx.payment.create({ data: { userId: owner.id, seasonId: season.id, seasonEntryId: entry.id, provider: provider.name, amountCents: current.entryPriceCents, currency: current.currency, status: "PENDING" } });
    return { entry, payment };
  });
  if ("error" in result) return { error: result.error };
  const { entry, payment } = result;

  // Capability cookie: proves this browser started the checkout, so the
  // checkout page does not have to rely on the payment id being unguessable.
  const store = await cookies();
  store.set(PENDING_PAYMENT_COOKIE, payment.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 60 * 60 * 2,
  });

  const session = await provider.createCheckout({
    paymentId: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    description: `${season.name} entry — ${name}`,
    customerEmail: email,
    successUrl: `${env.appUrl}/entry/${entry.manageToken}`,
    cancelUrl: `${env.appUrl}/enter`,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerPaymentId: session.providerPaymentId },
  });

  redirect(session.url);
}

/** Only accept http(s) URLs for images we later render. */
function asOptionalUrl(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}
