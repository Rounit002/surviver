"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Wordmark } from "@/components/brand/Wordmark";
import { ButtonLink } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const LINKS = [
  { href: "/board", label: "Board" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/seasons", label: "Seasons" },
  { href: "/survivors", label: "Survivors" },
  { href: "/how-it-works", label: "How it works" },
];

/**
 * A floating pane rather than a band across the top.
 *
 * At the top of the page it is invisible and the hero runs behind it. Once the
 * page moves it takes on a tint, an edge and a shadow — so the nav announces
 * itself only when it has started covering something up. The blur underneath
 * is always on; see `.nav-surface` for why that is not the same as switching
 * the glass on at the same moment.
 *
 * The active link is marked with a hairline under the label rather than a
 * filled pill. At this size a filled state competes with the one real action
 * in the bar, and there should only ever be one of those.
 */
export function NavBar({ ticker }: { ticker?: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const trigger = useRef<HTMLButtonElement>(null);

  // The panel remembers which route it was opened on, and is only open while
  // that is still the current one. Deriving it this way closes the menu on any
  // navigation — including the back button, which an onClick on each link
  // would miss — without an effect that re-renders just to correct itself.
  const [menu, setMenu] = useState({ open: false, path: pathname });
  const open = menu.open && menu.path === pathname;
  const setOpen = (next: boolean) => setMenu({ open: next, path: pathname });

  useEffect(() => {
    // `passive` because this listener never calls `preventDefault`, and saying
    // so lets the browser scroll without waiting to find out.
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 pt-3 sm:pt-4">
      <div className="shell">
        <div
          className={cn(
            "nav-surface relative flex h-14 items-center justify-between gap-3 rounded-[14px] pr-2 pl-3 sm:pl-4",
            scrolled && "is-scrolled",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Wordmark size="sm" />
            {ticker ? <div className="hidden min-w-0 xl:block">{ticker}</div> : null}
          </div>

          {/* Centred independently of the two flanks, so the links stay put
              when the season ticker appears or the CTA label changes length. */}
          <nav
            aria-label="Main"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex"
          >
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-[8px] px-3 py-2 text-[13.5px] transition-colors duration-[var(--dur-fast)]",
                    active ? "text-foreground" : "text-subtle hover:text-foreground",
                  )}
                >
                  {link.label}
                  {active ? (
                    <span
                      aria-hidden
                      className="bg-foreground absolute inset-x-3 -bottom-px h-px rounded-full"
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <div className="hidden sm:block">
              <ButtonLink href="/enter" variant="primary" size="sm">
                Enter. Earn your spot.
              </ButtonLink>
            </div>

            <button
              ref={trigger}
              type="button"
              aria-expanded={open}
              aria-controls="nav-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen(!open)}
              className="text-subtle hover:text-foreground hover:bg-muted flex size-9 items-center justify-center rounded-[10px] transition-colors duration-[var(--dur-fast)] lg:hidden"
            >
              {/* Two lines that cross rather than a swapped icon: the shape
                  animates, so the control reads as the same object changing
                  state instead of one icon being replaced by another. */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path
                  d="M4 8h16"
                  className="origin-center transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)]"
                  style={open ? { transform: "translateY(4px) rotate(45deg)" } : undefined}
                />
                <path
                  d="M4 16h16"
                  className="origin-center transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)]"
                  style={open ? { transform: "translateY(-4px) rotate(-45deg)" } : undefined}
                />
              </svg>
            </button>
          </div>
        </div>

        <div
          id="nav-menu"
          className={cn(
            "nav-surface is-scrolled absolute inset-x-5 mt-2 rounded-[14px] p-2 sm:inset-x-8 lg:hidden",
            "nav-menu",
            open && "is-open",
          )}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            setOpen(false);
            trigger.current?.focus();
          }}
        >
          <nav aria-label="Menu" className="grid gap-0.5">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className="text-subtle hover:bg-muted hover:text-foreground aria-[current=page]:text-foreground flex min-h-11 items-center rounded-[10px] px-3 text-sm transition-colors duration-[var(--dur-fast)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="border-border mt-2 border-t pt-2">
            <ButtonLink href="/enter" variant="primary" size="md" className="w-full">
              Enter. Earn your spot.
            </ButtonLink>
          </div>
        </div>
      </div>
    </header>
  );
}
