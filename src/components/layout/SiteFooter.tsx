import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { BrandIcon, SOCIAL_LINKS } from "@/components/ui/BrandIcon";

/**
 * Brand and socials on the left, links grouped by what the reader is looking
 * for on the right, and a baseline carrying the required paid-placement
 * disclosure (PRD 16).
 */
const GROUPS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Explore",
    links: [
      { href: "/board", label: "Board" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/survivors", label: "Survivors" },
      { href: "/seasons", label: "Seasons" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/rules", label: "Rules" },
      { href: "/dashboard", label: "Your campaigns" },
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

const SOCIALS = [
  { brand: "youtube", href: SOCIAL_LINKS.youtube, label: "YouTube" },
  { brand: "discord", href: SOCIAL_LINKS.discord, label: "Discord" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-border bg-elevated/60 border-t">
      <div className="shell py-12 sm:py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] md:gap-8">
          <div>
            <Wordmark size="sm" />
            <p className="text-subtle mt-3 max-w-xs text-sm">32 SaaS spots, ranked by real clicks.</p>
            <div className="mt-5 flex gap-2">
              {SOCIALS.map((social) => (
                <a
                  key={social.brand}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="border-border bg-surface hover:border-border-strong flex size-10 items-center justify-center rounded-[11px] border transition-[transform,border-color] duration-150 hover:-translate-y-0.5"
                >
                  <BrandIcon brand={social.brand} size={19} />
                </a>
              ))}
            </div>
          </div>

          {/* Side by side on a phone too, so the footer stays short. */}
          <div className="grid grid-cols-3 gap-4 md:contents">
            {GROUPS.map((group) => (
              <nav key={group.heading} aria-label={group.heading}>
                <h2 className="text-sm font-semibold">{group.heading}</h2>
                <ul className="mt-3 space-y-0.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-subtle hover:text-foreground inline-flex min-h-9 items-center text-sm transition-colors duration-[var(--dur-fast)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="border-border text-subtle mt-10 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Surviver.lol</p>
          <p>Paid placements. Rank is earned, never bought.</p>
        </div>
      </div>
    </footer>
  );
}
