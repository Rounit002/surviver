"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { CAMPAIGN_TOKEN_COOKIE, PENDING_PAYMENT_COOKIE } from "@/lib/competition/constants";
import { getOpenSeason, CLAIMED_ENTRY_STATUSES } from "@/lib/competition/season";
import { lockSeason } from "@/lib/competition/engine";
import { getPaymentProvider } from "@/lib/payments";
import { fetchSiteMetadata, normalizeUrl, UnsafeUrlError } from "@/lib/products/site-metadata";
import { hashCapability } from "@/lib/security/tokens";
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

type EntryField = "url" | "name" | "tagline" | "description" | "category" | "email" | "rules";

export type EntryFormState = {
  error?: string;
  fieldErrors?: Partial<Record<EntryField, string>>;
};

const entrySchema = z.object({
  url: z.string().min(1, "Enter your product URL.").max(2048, "That URL is too long."),
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
  const parsed = entrySchema.safeParse({ url: formData.get("url") });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<EntryField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "url") fieldErrors.url ??= issue.message;
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

  let metadata = null;
  try {
    metadata = await fetchSiteMetadata(url);
    url = metadata.url;
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return { fieldErrors: { url: error.message } };
    }
    // A site can still be entered if it blocks metadata requests; the hostname
    // provides a useful listing name and its favicon can be loaded by the card.
  }

  const provider = getPaymentProvider();
  const season = await getOpenSeason();
  if (!season) return { error: "No season is taking entries right now." };
  const hostname = new URL(url).hostname.replace(/^www\./i, "");
  const name = (metadata?.title?.trim() || hostname).slice(0, 60) || hostname.slice(0, 60);
  const tagline = (metadata?.description?.trim() || `Visit ${hostname}`).slice(0, 90);
  const description = (metadata?.description?.trim() || `${name} — visit ${hostname} to learn more.`).slice(0, 400);
  const category: ProductCategory = "AI";
  // The listing is managed with a short-lived capability link held in a secure
  // cookie; no founder email is needed to create the guest record or checkout.
  const email = `guest-${randomBytes(18).toString("hex")}@entry.surviver.lol`;
  const slug = `${slugify(name) || "product"}-${randomBytes(6).toString("hex")}`;
  const manageToken = randomBytes(32).toString("base64url");
  const checkoutToken = randomBytes(32).toString("base64url");
  const now = new Date();
  const result = await prisma.$transaction(async tx => {
    await lockSeason(tx, season.id);
    const current = await tx.season.findUniqueOrThrow({ where: { id: season.id } });
    if (current.status !== "REGISTRATION_OPEN" || (current.registrationStart && current.registrationStart > now) || (current.registrationEnd && current.registrationEnd <= now)) return { error: "Registration has closed." };
    const claimed = await tx.seasonEntry.count({ where: { seasonId: season.id, status: { in: CLAIMED_ENTRY_STATUSES } } });
    if (claimed >= current.capacity) return { error: "This season is full." };
    const duplicate = await tx.seasonEntry.findFirst({ where: { seasonId: season.id, product: { url }, OR: [
      { status: { notIn: ["REJECTED", "WITHDRAWN", "AWAITING_PAYMENT"] } },
      { status: "AWAITING_PAYMENT", createdAt: { gte: new Date(now.getTime() - 2 * 60 * 60_000) } },
    ] } });
    if (duplicate) return { error: "That URL already has an entry. Use your original checkout or private campaign link." };
    // Guest founder record (User.passwordHash stays null): entering requires
    // no account, and the campaign is reached by manageToken, not by login. An
    // address that enters twice reuses the same row.
    const owner = await tx.user.upsert({ where: { email }, update: {}, create: { email, name: email.split("@")[0]?.slice(0, 60) || "Founder" } });
    const product = await tx.product.create({ data: { ownerId: owner.id, name, slug, url, tagline, description, category, logoUrl: asOptionalUrl(metadata?.faviconUrl ?? null), coverUrl: asOptionalUrl(metadata?.imageUrl ?? null), approvalStatus: "DRAFT" } });
    const entry = await tx.seasonEntry.create({ data: { seasonId: season.id, productId: product.id, status: "AWAITING_PAYMENT", rallyCode: `${slugify(name).slice(0, 12) || "entry"}-${randomBytes(6).toString("hex")}`, manageToken: hashCapability(manageToken), manageTokenExpiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60_000) } });
    const payment = await tx.payment.create({ data: { userId: owner.id, seasonId: season.id, seasonEntryId: entry.id, provider: provider.name, amountCents: current.entryPriceCents, currency: current.currency, status: "PENDING", checkoutTokenHash: hashCapability(checkoutToken), checkoutTokenExpiresAt: new Date(now.getTime() + 2 * 60 * 60_000) } });
    return { entry, payment };
  });
  if ("error" in result) return { error: result.error };
  const { entry, payment } = result;

  // Capability cookie: proves this browser started the checkout, so the
  // checkout page does not have to rely on the payment id being unguessable.
  const store = await cookies();
  const capabilityCookie = {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 60 * 60 * 2,
  } as const;
  store.set(PENDING_PAYMENT_COOKIE, checkoutToken, capabilityCookie);
  // Held here rather than sent to the provider as a return URL, so the private
  // campaign capability never lands in provider dashboards, logs or analytics.
  store.set(CAMPAIGN_TOKEN_COOKIE, manageToken, capabilityCookie);

  let session;
  try {
    session = await provider.createCheckout({
      paymentId: payment.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
      description: `${season.name} entry — ${name}`,
      customerEmail: "",
      successUrl: `${env.appUrl}/enter/complete`,
      cancelUrl: `${env.appUrl}/`,
    });
  } catch (error) {
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } }),
      prisma.seasonEntry.update({ where: { id: entry.id }, data: { status: "WITHDRAWN", manageTokenRevokedAt: new Date() } }),
    ]).catch(() => undefined);
    throw error;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerCheckoutId: session.providerCheckoutId },
  });

  redirect(session.url);
}

/** Only accept http(s) URLs for images we later render. */
function asOptionalUrl(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && value.length <= 2048 ? parsed.toString() : null;
  } catch {
    return null;
  }
}
