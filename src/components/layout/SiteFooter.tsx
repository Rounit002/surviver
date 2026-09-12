import Link from "next/link";
import { Fragment } from "react";

const LINKS = [
  { href: "/rules", label: "Rules" },
  { href: "/how-it-works", label: "How scoring works" },
  { href: "/seasons", label: "Seasons" },
  { href: "/survivors", label: "Survivors" },
  { href: "/dashboard", label: "Your campaigns" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

/**
 * Centred and quiet, in the manner of the leaderboard sites this is modelled
 * on: the board is the product, so the footer stays out of the way.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 pb-10 text-center">
      <div className="mx-auto w-full max-w-5xl px-4">
        <p className="text-subtle text-sm">
          Surviver.lol is a promotional tournament for SaaS products. 32 enter, one survives.
        </p>

        {/* Flex-wrap rather than inline text: adjacent JSX elements produce no
            whitespace, so an inline run of links has no break opportunities and
            overflows narrow screens. */}
        <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm">
          {LINKS.map((link, i) => (
            <Fragment key={link.href}>
              {i > 0 ? (
                <span className="text-faint" aria-hidden>
                  &middot;
                </span>
              ) : null}
              <Link
                href={link.href}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                {link.label}
              </Link>
            </Fragment>
          ))}
        </nav>

        <p className="text-faint mx-auto mt-6 max-w-md text-[12px] leading-relaxed">
          Paid promotional placements. Ranking is earned from measured interest, never purchased.
        </p>
      </div>
    </footer>
  );
}
