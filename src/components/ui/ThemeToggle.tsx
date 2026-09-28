"use client";

import { cn } from "@/lib/cn";

/**
 * The light/dark switch.
 *
 * Light is the default and the only thing that moves off it is a stored
 * choice — the OS is deliberately not consulted. `prefers-color-scheme` would
 * hand a dark-desktop visitor a dark page on their first visit, and the site
 * is meant to open in light.
 *
 * ## Why there is no React state here
 *
 * The theme is already decided before this component exists: the inline script
 * in the root layout reads storage and sets `data-theme` before the page
 * paints. If the button rendered its face from state it would have to start on
 * the server's guess and then correct itself, which is a visible flicker on
 * every load and a hydration mismatch if it tried to read the DOM during
 * render. So the DOM attribute stays the one source of truth: both faces ship
 * in the markup, CSS shows whichever matches, and the click just flips the
 * attribute. Nothing to synchronise, nothing to get out of step.
 */
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "group border-border bg-muted hover:border-border-strong relative flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border p-1",
        "text-subtle transition-colors duration-[var(--dur-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      onClick={() => {
        const root = document.documentElement;
        const next = root.dataset.theme === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        // A private window, or storage the reader has blocked, still gets a
        // working toggle for the visit — it just will not be remembered.
        try {
          localStorage.setItem("theme", next);
        } catch {}
        // The browser chrome on mobile is painted from this, so it has to move
        // with the page or a dark page keeps a white status bar.
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute("content", next === "dark" ? "#1a1512" : "#fffdfa");
      }}
    >
      <span
        aria-hidden="true"
        className="bg-surface shadow-sm absolute left-1 top-1 size-6 rounded-full transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] dark:translate-x-6"
      />
      <svg
        aria-hidden="true"
        className="relative z-10 ml-1 text-foreground transition-colors"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.4 12H2.2M21.8 12h-2.2M6.6 6.6 5 5M19 19l-1.6-1.6M17.4 6.6 19 5M5 19l1.6-1.6" />
      </svg>
      <svg
        aria-hidden="true"
        className="relative z-10 ml-auto mr-1 transition-colors dark:text-foreground"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7Z" />
      </svg>
      <span className="theme-when-light sr-only">Switch to dark theme</span>
      <span className="theme-when-dark sr-only">Switch to light theme</span>
    </button>
  );
}
