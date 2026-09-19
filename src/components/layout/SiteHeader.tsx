import Link from "next/link";
import { Suspense } from "react";
import { NavBar } from "@/components/layout/NavBar";
import { LiveDot } from "@/components/ui/Chip";
import { getActiveRound, getCurrentSeason } from "@/lib/competition/season";
import { prisma } from "@/lib/db";
import { formatCount } from "@/lib/format";

/**
 * The server half of the navigation: it does the data fetching and hands the
 * result to `NavBar`, which has to be a client component because it knows
 * about scroll position and an open menu.
 *
 * The ticker is passed as a prop rather than fetched on the client, so the
 * season's state is in the first HTML response and never pops in. It has its
 * own `Suspense` boundary, so a slow standings query delays the ticker rather
 * than the whole navigation.
 */
export async function SiteHeader() {
  return (
    <NavBar
      ticker={
        <Suspense fallback={null}>
          <SeasonTicker />
        </Suspense>
      }
    />
  );
}

/**
 * Live state of the competition, in the quietest form that still says
 * something: the season, and the one number actually moving.
 */
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
        className="text-subtle hover:text-foreground inline-flex max-w-full items-center gap-2 text-[13px] whitespace-nowrap transition-colors duration-[var(--dur-fast)]"
      >
        <LiveDot />
        <span className="text-foreground font-medium">{season.name}</span>
        <span className="text-border-strong" aria-hidden>
          |
        </span>
        <span>
          <span className="num">{formatCount(competing)}</span> competing
        </span>
        {round ? (
          <span className="text-danger">
            <span className="num">{formatCount(round.eliminationCount)}</span> go out
          </span>
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
        className="text-subtle hover:text-foreground inline-flex max-w-full items-center gap-2 text-[13px] whitespace-nowrap transition-colors duration-[var(--dur-fast)]"
      >
        <span className="text-foreground font-medium">{season.name}</span>
        <span className="text-border-strong" aria-hidden>
          |
        </span>
        <span>
          {claimed >= season.capacity ? (
            "all spots filled"
          ) : (
            <>
              <span className="num">{formatCount(season.capacity - claimed)}</span> spots left
            </>
          )}
        </span>
      </Link>
    );
  }

  return null;
}
