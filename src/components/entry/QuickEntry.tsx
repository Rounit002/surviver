"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { createEntryAction, type EntryFormState } from "@/lib/products/actions";

const URL_PLACEHOLDERS = ["yourproduct.com", "saasapp.io", "cooltool.dev", "emoggle.com"];

interface QuickEntryProps {
  available: boolean;
  full?: boolean;
  priceLabel?: string;
}

export function QuickEntry({ available, full = false, priceLabel }: QuickEntryProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [state, formAction, submitting] = useActionState(
    createEntryAction,
    {} as EntryFormState,
  );

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("enter") === "1") {
      dialog.current?.showModal();
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
    const timer = window.setInterval(() => {
      setPlaceholderIndex((index) => (index + 1) % URL_PLACEHOLDERS.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <div className="border-border bg-surface shadow-sm mx-auto flex w-full max-w-2xl flex-col gap-2 rounded-[16px] border p-2 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Icon name="globe" width="17" height="17" className="text-faint pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" />
          <label htmlFor="quick-url-preview" className="sr-only">Your site URL</label>
          <input
            id="quick-url-preview"
            readOnly
            onClick={() => dialog.current?.showModal()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") dialog.current?.showModal();
            }}
            placeholder={URL_PLACEHOLDERS[placeholderIndex]}
            className="placeholder:text-faint/70 text-foreground h-11 w-full cursor-text rounded-[10px] bg-transparent pr-3 pl-10 text-base outline-none sm:text-sm"
          />
        </div>
        <div className="bg-border hidden h-6 w-px shrink-0 md:block" aria-hidden />
        <div className="flex shrink-0 items-center gap-2">
          {priceLabel ? <span className="bg-muted text-subtle hidden rounded-[8px] px-2.5 py-1 text-xs font-semibold sm:inline-block">{priceLabel}</span> : null}
          <button
            type="button"
            disabled={!available}
            onClick={() => dialog.current?.showModal()}
            className="bg-primary text-primary-foreground flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[11px] px-5 text-sm font-semibold shadow-sm transition-all duration-150 hover:brightness-105 hover:shadow-md active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{available ? "Enter Season" : full ? "All Spots Filled" : "Opening Soon"}</span>
            <Icon name="arrow" width="15" height="15" />
          </button>
        </div>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="entry-dialog-title"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
        className="bg-surface text-foreground m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border p-0 shadow-2xl backdrop:bg-black/60"
      >
        <form action={formAction} className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label text-primary">Season entry</p>
              <h2 id="entry-dialog-title" className="mt-2 text-xl font-semibold">Enter your site</h2>
              <p className="text-subtle mt-2 text-sm leading-relaxed">Add your website URL, then continue to secure payment.</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="text-subtle hover:text-foreground flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors">×</button>
          </div>

          <label htmlFor="entry-url" className="text-subtle mt-6 mb-2 block text-sm font-medium">Website URL</label>
          <input
            id="entry-url"
            name="url"
            required
            maxLength={2048}
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="yourproduct.com"
            aria-invalid={Boolean(state.fieldErrors?.url)}
            className="border-border bg-background text-foreground placeholder:text-faint focus:border-primary focus:ring-primary/20 h-12 w-full rounded-xl border px-4 text-base outline-none focus:ring-2"
          />
          {state.fieldErrors?.url ? <p className="text-danger mt-2 text-sm">{state.fieldErrors.url}</p> : null}
          {state.error ? <p role="alert" className="text-danger mt-3 text-sm">{state.error}</p> : null}

          <button type="submit" disabled={!available || submitting} className="bg-primary text-primary-foreground mt-5 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? "Preparing secure checkout…" : `Continue to payment${priceLabel ? ` · ${priceLabel}` : ""}`}
          </button>
          <p className="text-faint mt-3 text-center text-xs">Payment details are entered securely at checkout.</p>
        </form>
      </dialog>
    </>
  );
}
