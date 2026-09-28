"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { lookupSite, looksLikeUrl, openEntry } from "./entry-bus";

const URL_PLACEHOLDERS = ["yourproduct.com", "saasapp.io", "cooltool.dev", "launch.ai"];

/**
 * The hero's entry bar. It only collects the URL and opens the shared dialog
 * (mounted in the site layout) — but it starts reading the site while the
 * founder is still typing, so the dialog opens with the preview ready.
 */
export function QuickEntry({ available, full = false, priceLabel }: { available: boolean; full?: boolean; priceLabel?: string }) {
  const [url, setUrl] = useState("");
  const [placeholder, setPlaceholder] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setPlaceholder((i) => (i + 1) % URL_PLACEHOLDERS.length), 2400);
    return () => window.clearInterval(timer);
  }, []);

  // Warm the lookup once the text looks like a domain and typing pauses.
  useEffect(() => {
    if (!available || !looksLikeUrl(url)) return;
    const timer = window.setTimeout(() => void lookupSite(url), 600);
    return () => window.clearTimeout(timer);
  }, [url, available]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (available) openEntry(url);
      }}
      className="border-border bg-surface shadow-sm mx-auto flex w-full flex-col gap-2 rounded-[16px] border p-2 md:flex-row md:items-center"
    >
      <div className="relative min-w-0 flex-1">
        <Icon name="globe" width={17} className="text-subtle pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" />
        <label htmlFor="quick-url" className="sr-only">Your product URL</label>
        <input
          id="quick-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={URL_PLACEHOLDERS[placeholder]}
          maxLength={2048}
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          className="placeholder:text-subtle/70 text-foreground h-11 w-full rounded-[10px] bg-transparent pr-3 pl-10 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:text-sm"
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {priceLabel ? <span className="bg-muted text-subtle hidden rounded-[8px] px-2.5 py-1 text-xs font-semibold sm:inline-block">{priceLabel}</span> : null}
        <button
          type="submit"
          disabled={!available}
          className="btn-primary text-primary-foreground flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[11px] px-5 text-sm font-semibold transition-[filter,transform] duration-150 hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 md:flex-none"
        >
          {available ? "Enter. Earn your spot." : full ? "All spots filled" : "Opening soon"}
          <Icon name="arrow" width={15} />
        </button>
      </div>
    </form>
  );
}
