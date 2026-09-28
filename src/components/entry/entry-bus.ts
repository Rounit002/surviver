"use client";

import { lookupSiteAction, type LookupResult } from "@/lib/products/actions";

/**
 * How any button on any page opens the entry dialog without a navigation.
 *
 * The dialog is mounted once in the site layout and listens for this event.
 * Before this, every "Claim a spot" was a link to /enter, which redirected to
 * the home page and reloaded it before the dialog could open — a full page
 * round trip for what should be instant.
 */
export const OPEN_ENTRY_EVENT = "surviver:open-entry";

export function openEntry(url?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_ENTRY_EVENT, { detail: { url: url?.trim() || undefined } }));
}

/**
 * Site lookups, remembered for the life of the tab.
 *
 * The hero field starts the lookup while the founder is still typing, so by
 * the time they press Enter the dialog already has the name and icon to show.
 * The same promise is shared, so nothing is fetched twice.
 */
const lookups = new Map<string, Promise<LookupResult>>();
const keyFor = (rawUrl: string) => rawUrl.trim().toLowerCase().replace(/\/+$/, "");

/** Whether this URL was already looked up (or is being), so no debounce is needed. */
export function hasLookup(rawUrl: string): boolean {
  return lookups.has(keyFor(rawUrl));
}

export function lookupSite(rawUrl: string): Promise<LookupResult> {
  const key = keyFor(rawUrl);
  const cached = lookups.get(key);
  if (cached) return cached;
  const pending = lookupSiteAction(rawUrl.trim()).catch(() => ({
    ok: false,
    error: "We couldn’t fetch that site’s details. You can still continue.",
  }) as LookupResult);
  lookups.set(key, pending);
  // A failed lookup may succeed later (a site that was briefly down), so it
  // is not kept.
  void pending.then((result) => {
    if (!result.ok) lookups.delete(key);
  });
  return pending;
}

/** True once the text looks enough like a domain to be worth fetching. */
export function looksLikeUrl(value: string): boolean {
  return /^(https?:\/\/)?[^\s/.]+\.[^\s/]{2,}/i.test(value.trim());
}
