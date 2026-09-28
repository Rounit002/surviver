"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { CAMPAIGN_TOKEN_COOKIE, CHECKOUT_HOLD_MS, PENDING_PAYMENT_COOKIE } from "@/lib/competition/constants";
import { getOpenSeason, blockingEntryFilter, countTakenSpots } from "@/lib/competition/season";
import { lockSeason } from "@/lib/competition/engine";
import { getPaymentProvider } from "@/lib/payments";
import { fetchSiteMetadata, normalizeUrl, UnsafeUrlError } from "@/lib/products/site-metadata";
import { hashCapability } from "@/lib/security/tokens";
import { checkRequestLimit } from "@/lib/security/rate-limit";
import { cleanText } from "@/lib/security/text";
import { getSessionUser } from "@/lib/auth/session";
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
export async function lookupSiteAction(rawUrl: unknown): Promise<LookupResult> {
  // A server action is a public endpoint: the argument is whatever a script
  // posts, not what the typed client sends. Validate before spending a
  // rate-limit hit or a network request on it.
  const parsed = lookupSchema.safeParse(rawUrl);
  if (!parsed.success) return { ok: false, error: "Enter a valid website URL." };

  try {
    // Lookups now start while the founder types (debounced, cached per tab),
    // so a few more per window than one-per-submit. Still bounded per IP.
    const limit = await checkRequestLimit("site-metadata", 15, 10 * 60_000);
    if (!limit.allowed) return { ok: false, error: "Too many site lookups. Wait a few minutes and try again." };
  } catch (error) {
    console.error("[surviver] site lookup limit unavailable", error);
    return { ok: false, error: "Site lookup is temporarily unavailable. Fill the details in by hand." };
  }

  try {
    const metadata = await fetchSiteMetadata(parsed.data);
    return {
      ok: true,
      url: metadata.url,
      name: cleanText(metadata.title, 60) || undefined,
      description: cleanText(metadata.description, 400) || undefined,
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

const urlField = z.string().trim().min(1, "Enter your product URL.").max(2048, "That URL is too long.");
const lookupSchema = urlField;
const entrySchema = z.object({ url: urlField });

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

  try {
    const limit = await checkRequestLimit("entry-create", 5, 60 * 60_000);
    if (!limit.allowed) return { error: "Too many entry attempts. Wait an hour before trying again." };
  } catch (error) {
    console.error("[surviver] entry creation limit unavailable", error);
    return { error: "Entry creation is temporarily unavailable. Please try again shortly." };
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
  const signedInOwner = await getSessionUser();
  const season = await getOpenSeason();
  if (!season) return { error: "No season is taking entries right now." };
  const hostname = new URL(url).hostname.replace(/^www\./i, "");
  const scrapedTitle = cleanText(metadata?.title, 60);
  const scrapedDescription = cleanText(metadata?.description, 400);
  const name = scrapedTitle || hostname.slice(0, 60);
  const tagline = cleanText(scrapedDescription, 90) || `Visit ${hostname}`;
  const description = scrapedDescription || `${name} — visit ${hostname} to learn more.`;
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
    // Phase one of the two-phase sale: under the season lock, a checkout is
    // only opened if a spot is free counting both paid spots and spots other
    // founders are holding in checkout right now. The hold lapses on its own
    // after CHECKOUT_HOLD_MS, so an abandoned tab returns its spot to the pool.
    const { claimed, held } = await countTakenSpots(tx, season.id, now);
    if (claimed >= current.capacity) return { error: "This season is full." };
    if (claimed + held >= current.capacity) return { error: "Every remaining spot is being checked out right now. Try again in a few minutes." };
    const duplicate = await tx.seasonEntry.findFirst({ where: blockingEntryFilter(season.id, url, now) });
    if (duplicate) return { error: "That URL already has an entry. Use your original checkout or private campaign link." };
    // Guest founder record (User.passwordHash stays null): entering requires
    // no account, and the campaign is reached by manageToken, not by login. An
    // address that enters twice reuses the same row.
    const owner = signedInOwner ?? await tx.user.create({ data: { email, name: "Founder" } });
    const product = await tx.product.create({ data: { ownerId: owner.id, name, slug, url, tagline, description, category, logoUrl: asOptionalUrl(metadata?.faviconUrl ?? null), coverUrl: asOptionalUrl(metadata?.imageUrl ?? null), approvalStatus: "DRAFT" } });
    const entry = await tx.seasonEntry.create({ data: { seasonId: season.id, productId: product.id, status: "AWAITING_PAYMENT", rallyCode: `${slugify(name).slice(0, 12) || "entry"}-${randomBytes(6).toString("hex")}`, manageToken: hashCapability(manageToken), manageTokenExpiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60_000) } });
    const payment = await tx.payment.create({ data: { userId: owner.id, seasonId: season.id, seasonEntryId: entry.id, provider: provider.name, amountCents: current.entryPriceCents, currency: current.currency, status: "PENDING", checkoutTokenHash: hashCapability(checkoutToken), checkoutTokenExpiresAt: new Date(now.getTime() + CHECKOUT_HOLD_MS) } });
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
    maxAge: CHECKOUT_HOLD_MS / 1000,
  } as const;
  store.set(PENDING_PAYMENT_COOKIE, checkoutToken, capabilityCookie);
  // Held here rather than sent to the provider as a return URL, so the private
  // campaign capability never lands in provider dashboards, logs or analytics.
  // It outlives the spot hold: a founder who pays late may be refunded, but
  // must still be able to reach their campaign page to see why.
  store.set(CAMPAIGN_TOKEN_COOKIE, manageToken, { ...capabilityCookie, maxAge: 2 * 60 * 60 });

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
