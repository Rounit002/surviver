"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { Icon } from "@/components/ui/Icon";
import { SiteFavicon } from "@/components/product/SiteFavicon";
import { createEntryAction, type EntryFormState, type LookupResult } from "@/lib/products/actions";
import { hasLookup, lookupSite, looksLikeUrl, OPEN_ENTRY_EVENT } from "./entry-bus";

/**
 * The one entry dialog, mounted once in the site layout.
 *
 * Any button calls `openEntry()` and this opens in place — no navigation, no
 * reload. The site preview is decoration: the pay button never waits for it,
 * and the server reads the site itself either way.
 */
export function EntryDialog({ available, full, priceLabel }: { available: boolean; full: boolean; priceLabel?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<LookupResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [state, formAction, submitting] = useActionState(createEntryAction, {} as EntryFormState);

  // Open on request from anywhere on the page, and on /?enter=1 (the /enter
  // route and old links land here).
  useEffect(() => {
    const open = (event: Event) => {
      const next = (event as CustomEvent<{ url?: string }>).detail?.url;
      if (next !== undefined) setUrl(next);
      if (!dialog.current?.open) dialog.current?.showModal();
      if (!next) requestAnimationFrame(() => input.current?.focus());
    };
    window.addEventListener(OPEN_ENTRY_EVENT, open);
    const params = new URLSearchParams(window.location.search);
    if (params.get("enter") === "1") {
      dialog.current?.showModal();
      params.delete("enter");
      const query = params.toString();
      window.history.replaceState(window.history.state, "", window.location.pathname + (query ? `?${query}` : ""));
    }
    return () => window.removeEventListener(OPEN_ENTRY_EVENT, open);
  }, []);

  // Preview the site. Usually already fetched while the founder typed in the
  // hero, in which case this resolves on the next tick.
  useEffect(() => {
    if (!looksLikeUrl(url)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLookingUp(true);
      void lookupSite(url).then((result) => {
        if (cancelled) return;
        setLookingUp(false);
        setPreview(result);
      });
      // Already fetched while typing in the hero: show it now. Otherwise wait
      // for the founder to pause.
    }, hasLookup(url) ? 0 : 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [url]);

  // A preview only ever describes the URL currently in the field.
  const valid = looksLikeUrl(url);
  const shown = valid ? preview : null;
  const loading = valid && lookingUp;
  const host = siteHost(shown?.url ?? url);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="entry-dialog-title"
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
      className="entry-dialog bg-surface text-foreground m-auto w-[calc(100%-2rem)] max-w-md rounded-[20px] border border-border p-0 text-left shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-[3px]"
    >
      <form action={formAction} className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="entry-dialog-title" className="text-xl font-semibold">Claim your spot</h2>
            <p className="text-subtle mt-1 text-sm">{priceLabel ? `${priceLabel} once. Live all season.` : "Live all season."}</p>
            <p className="text-subtle mt-2 flex items-center gap-1.5 text-xs">
              <BrandIcon brand="youtube" size={14} />
              <BrandIcon brand="discord" size={14} />
              Plus a YouTube Live feature and a Discord shout-out
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="text-subtle hover:text-foreground hover:bg-muted -mt-1.5 -mr-2 flex size-9 cursor-pointer items-center justify-center rounded-[10px] text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <label htmlFor="entry-url" className="mt-6 mb-2 block text-sm font-medium">Your product’s URL</label>
        <div className="relative">
          <Icon name="globe" width={16} className="text-subtle pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" />
          <input
            ref={input}
            id="entry-url"
            name="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
            maxLength={2048}
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="yourproduct.com"
            aria-invalid={Boolean(state.fieldErrors?.url)}
            className="border-border bg-background text-foreground placeholder:text-subtle/70 focus:border-primary focus:ring-primary/20 h-12 w-full rounded-xl border pr-4 pl-10 text-base outline-none focus:ring-2"
          />
        </div>
        {state.fieldErrors?.url ? <p className="text-danger mt-2 text-sm">{state.fieldErrors.url}</p> : null}

        {/* Fixed height, so the dialog does not jump when the preview lands. */}
        <div className="mt-3 min-h-[3.75rem]">
          {shown?.ok ? (
            <div className="border-border bg-muted/40 flex items-center gap-3 rounded-xl border p-2.5">
              <SiteFavicon name={shown.name || host} siteUrl={shown.url || url} logoUrl={shown.faviconUrl ?? null} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{shown.name || host}</p>
                <p className="text-subtle truncate text-xs">{shown.description || host}</p>
              </div>
              <Icon name="check" width={16} className="text-live ml-auto shrink-0" />
            </div>
          ) : loading ? (
            <div className="border-border flex items-center gap-3 rounded-xl border p-2.5" aria-live="polite">
              <span className="bg-muted size-10 shrink-0 animate-pulse rounded-[10px]" />
              <div className="flex-1 space-y-2">
                <span className="bg-muted block h-2.5 w-2/5 animate-pulse rounded-full" />
                <span className="bg-muted block h-2 w-3/5 animate-pulse rounded-full" />
              </div>
            </div>
          ) : shown && !shown.ok ? (
            <p role="status" className="text-subtle px-1 pt-1 text-xs">{shown.error}</p>
          ) : null}
        </div>

        {state.error ? <p role="alert" className="text-danger mb-3 text-sm">{state.error}</p> : null}

        <button
          type="submit"
          disabled={!available || submitting || !url.trim()}
          className="btn-primary text-primary-foreground flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
              Opening secure checkout…
            </>
          ) : available ? (
            <>
              Continue to payment{priceLabel ? ` · ${priceLabel}` : ""}
              <Icon name="arrow" width={16} />
            </>
          ) : full ? (
            "All spots are taken"
          ) : (
            "Entries open soon"
          )}
        </button>
        <p className="text-subtle mt-3 flex items-center justify-center gap-1.5 text-xs">
          <Icon name="lock" width={12} />
          Secure checkout by Dodo Payments
        </p>
      </form>
    </dialog>
  );
}

function siteHost(value: string): string {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./i, "");
  } catch {
    return value;
  }
}
