import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

/**
 * Three short columns and a baseline, rather than one long centred run of
 * links.
 *
 * A footer is the one place on a site where a list of links is genuinely what
 * the reader wants, so the job is grouping rather than reduction: someone
 * looking for the rules should not have to read past Privacy to find them.
 * Everything stays in the quiet ink — the footer is a destination you arrive
 * at deliberately, and it should not compete with the page above it.
 */
const GROUPS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Compete",
    links: [
      { href: "/enter", label: "Enter. Earn your spot." },
      { href: "/board", label: "The board" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/dashboard", label: "Your campaigns" },
    ],
  },
  {
    heading: "Understand",
    links: [
      { href: "/how-it-works", label: "How scoring works" },
      { href: "/rules", label: "Competition rules" },
      { href: "/seasons", label: "Seasons" },
      { href: "/survivors", label: "Hall of Survivors" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/sitemap", label: "Site map" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="shell py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] md:gap-8">
          <div className="max-w-xs">
            <Wordmark size="sm" />
            <p className="text-subtle mt-4 text-sm leading-relaxed">
              A promotional tournament for SaaS products. Thirty-five enter, one survives.
            </p>
          </div>

          {GROUPS.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="label label-bright">{group.heading}</h2>
              <ul className="mt-4 space-y-1">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-subtle hover:text-foreground -mx-2 inline-flex min-h-9 items-center rounded-[6px] px-2 text-sm transition-colors duration-[var(--dur-fast)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-border mt-12 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-subtle text-xs">
            &copy; {new Date().getFullYear()} Surviver.lol
          </p>
          {/* Required disclosure (PRD 16): entries are paid placements, and the
              ranking is not. Kept on the baseline where a reader looking for
              the commercial arrangement will actually look for it. */}
          <p className="text-subtle text-xs">
            Paid promotional placements. Ranking is earned from measured interest, never purchased.
          </p>
        </div>
      </div>
    </footer>
  );
}
