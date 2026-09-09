import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { cn } from "@/lib/cn";
import { CategoryBar } from "@/components/layout/CategoryBar";
import { LiveDot } from "@/components/ui/Chip";
import { getActiveRound, getCurrentSeason } from "@/lib/competition/season";
import { prisma } from "@/lib/db";
import { formatCount } from "@/lib/format";

/**
 * Two rows, after outbid.lol: identity plus a live status pill on the first,
 * and a full-width category rail on the second. Not sticky — the board is long
 * and a pinned two-row header would eat the screen on a phone.
 */
export async function SiteHeader() {
  return (
    <header className="w-full">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 pt-5 pb-3.5 md:pb-4">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Wordmark />
            <div className="hidden min-w-0 md:block">
              <Suspense fallback={null}>
                <SeasonTicker />
              </Suspense>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-xs sm:gap-6 sm:text-sm">
            {[
              { href: "/board", label: "Board" },
              { href: "/leaderboard", label: "Leaderboard" },
              { href: "/seasons", label: "Seasons", from: "sm" },
              { href: "/survivors", label: "Survivors", from: "md" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                // Links drop off as the row gets tight rather than wrapping or
                // colliding with the wordmark.
                className={cn(
                  "text-subtle hover:text-foreground font-medium transition-colors",
                  link.from === "sm" && "hidden sm:inline",
                  link.from === "md" && "hidden md:inline",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <Suspense fallback={<div className="bg-muted h-10 rounded-full" />}>
          <CategoryBar />
        </Suspense>
      </div>
    </header>
  );
}

/** Live state of the competition, in the slot outbid uses for its stats pill. */
async function SeasonTicker() {
  const season = await getCurrentSeason();
  if (!season) return null;

  if (season.status === "RUNNING") {
    const round = await getActiveRound(season.id);
    const competing = await prisma.seasonEntry.count({
      where: { seasonId: season.id, status: { in: ["ACTIVE", "FINALIST"] } },
    });

    return (
      <Link
        href="/leaderboard"
        className="border-border text-subtle hover:text-foreground inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors"
      >
        <LiveDot />
        <span className="text-foreground font-medium">{season.name}</span>
        <span aria-hidden>&middot;</span>
        <span>
          <span className="num">{formatCount(competing)}</span> competing
        </span>
        {round ? (
          <>
            <span aria-hidden>&middot;</span>
            <span className="text-danger">
              <span className="num">{formatCount(round.eliminationCount)}</span> go out
            </span>
          </>
        ) : null}
      </Link>
    );
  }

  if (season.status === "REGISTRATION_OPEN") {
    const claimed = await prisma.seasonEntry.count({
      where: {
        seasonId: season.id,
        status: {
          in: ["AWAITING_APPROVAL", "UPCOMING", "ACTIVE", "ELIMINATED", "FINALIST", "SURVIVOR"],
        },
      },
    });

    return (
      <Link
        href="/enter"
        className="border-border text-subtle hover:text-foreground inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors"
      >
        <span className="text-foreground font-medium">{season.name}</span>
        <span aria-hidden>&middot;</span>
        <span>
          <span className="num">{formatCount(season.capacity - claimed)}</span> slots left
        </span>
        <span className="text-primary">&rarr;</span>
      </Link>
    );
  }

  return null;
}
