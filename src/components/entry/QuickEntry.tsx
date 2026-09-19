"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS, CATEGORY_VALUES } from "@/lib/competition/constants";
import { Icon } from "@/components/ui/Icon";

const URL_PLACEHOLDERS = [
  "yourproduct.com",
  "saasapp.io",
  "cooltool.dev",
  "growthkit.ai",
  "indieapp.co",
];

interface QuickEntryProps {
  available: boolean;
  full?: boolean;
  priceLabel?: string;
}

/**
 * The outbid.lol signature action dock:
 * An integrated, high-contrast claim bar with animated typing placeholder,
 * category selector, price pill, and high-impact CTA button.
 */
export function QuickEntry({ available, full = false, priceLabel }: QuickEntryProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderText, setPlaceholderText] = useState(URL_PLACEHOLDERS[0]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = URL_PLACEHOLDERS[placeholderIndex];
    const timeout = window.setTimeout(
      () => {
        if (!isDeleting && placeholderText === current) {
          setIsDeleting(true);
          return;
        }

        if (isDeleting && placeholderText.length === 0) {
          setIsDeleting(false);
          setPlaceholderIndex((prev) => (prev + 1) % URL_PLACEHOLDERS.length);
          return;
        }

        if (isDeleting) {
          setPlaceholderText((prev) => prev.slice(0, -1));
        } else {
          setPlaceholderText(current.slice(0, placeholderText.length + 1));
        }
      },
      placeholderText === current && !isDeleting
        ? 1800
        : isDeleting
          ? 35
          : 65,
    );

    return () => window.clearTimeout(timeout);
  }, [isDeleting, placeholderIndex, placeholderText]);

  return (
    <form
      action="/enter"
      className="border-border bg-surface shadow-sm hover:border-primary/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 mx-auto flex w-full max-w-2xl flex-col gap-2 rounded-[16px] border p-2 transition-all duration-200 md:flex-row md:items-center"
    >
      <div className="relative min-w-0 flex-1">
        <Icon
          name="globe"
          width="17"
          height="17"
          className="text-faint pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
        />
        <label htmlFor="quick-url" className="sr-only">
          Your product URL
        </label>
        <input
          id="quick-url"
          name="url"
          required
          maxLength={2048}
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={placeholderText}
          className="placeholder:text-faint/70 text-foreground h-11 w-full rounded-[10px] bg-transparent pr-3 pl-10 text-base outline-none transition-colors sm:text-sm"
        />
      </div>

      {/* Hairline divider */}
      <div className="bg-border hidden h-6 w-px shrink-0 md:block" aria-hidden />

      <div className="relative shrink-0 md:w-44">
        <label className="sr-only" htmlFor="quick-category">
          Category
        </label>
        <select
          id="quick-category"
          name="category"
          defaultValue=""
          required
          className="text-subtle hover:text-foreground h-11 w-full cursor-pointer appearance-none rounded-[10px] bg-transparent pr-8 pl-3 text-base outline-none transition-colors sm:text-sm"
        >
          <option value="" disabled>
            Select category
          </option>
          {CATEGORY_VALUES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs opacity-50">
          ▼
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {priceLabel ? (
          <span className="bg-muted text-subtle hidden rounded-[8px] px-2.5 py-1 text-xs font-semibold sm:inline-block">
            {priceLabel}
          </span>
        ) : null}

        <button
          disabled={!available}
          className="bg-primary text-primary-foreground flex h-11 shrink-0 items-center justify-center gap-2 rounded-[11px] px-5 text-sm font-semibold shadow-sm transition-all duration-150 hover:brightness-105 hover:shadow-md active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>{available ? "Enter Season" : full ? "All Spots Filled" : "Opening Soon"}</span>
          <Icon name="arrow" width="15" height="15" />
        </button>
      </div>
    </form>
  );
}
