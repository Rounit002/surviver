import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { Fragment } from "react";
import { RoundBar } from "@/components/competition/RoundBar";
import { ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { cn } from "@/lib/cn";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/competition/constants";
import { getActiveRound, getCurrentSeason } from "@/lib/competition/season";
import { getStandings, rankMovement, type StandingRow } from "@/lib/competition/standings";
import { formatCount, formatInterestRate } from "@/lib/format";

export const metadata = pageMetadata("/leaderboard");

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const season = await getCurrentSeason();
  const round = season ? await getActiveRound(season.id) : null;
  const standings = season
    ? await getStandings(season, round)
    : { rows: [], cutLineRank: null, eliminationCount: 0, survivorCount: 0 };

  if (!season || standings.rows.length === 0) {
    return (
      <div className="shell pt-8 pb-4">
        <header className="text-center">
          <h1 className="text-3xl font-semibold sm:text-4xl">Leaderboard</h1>
        </header>
        <Panel className="mt-8 px-6 py-16 text-center">
          <p className="text-subtle text-sm">Standings appear once a season is running.</p>
          <div className="mt-5">
            <ButtonLink href="/enter" variant="primary" size="sm">
              Enter. Earn your spot.
            </ButtonLink>
          </div>
        </Panel>
      </div>
    );
  }

  const serverNow = new Date().toISOString();
  const { rows, survivorCount, eliminationCount } = standings;

  return (
    <div className="shell pt-8 pb-4">
      <header className="text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">Leaderboard</h1>
        <p className="text-subtle mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-pretty">
          Ranked by Interest Rate — the share of viewers who chose to visit. Everything below
          the line goes out at zero.
        </p>
      </header>

      <div className="mt-7">
        <RoundBar season={season} round={round} competing={rows.length} serverNow={serverNow} />
      </div>

      <Panel className="mt-6 overflow-hidden">
        {/* Column headings, desktop only: the mobile layout is self-labelling. */}
        <div className="border-border text-faint hidden border-b px-4 py-2.5 md:grid md:grid-cols-[3rem_1fr_6rem_6rem_6rem_9rem] md:items-center md:gap-3">
          <div className="label">Rank</div>
          <div className="label">Product</div>
          <div className="label text-right">Interest</div>
          <div className="label text-right">Views</div>
          <div className="label text-right">Visits</div>
          <div className="label text-right">Status</div>
        </div>

        <ol className="divide-border divide-y">
          {rows.map((row, i) => (
            <Fragment key={row.entryId}>
              <li>
                <Row row={row} eliminated={(row.rank ?? 0) > survivorCount} />
              </li>
              {i + 1 === survivorCount && i + 1 < rows.length ? (
                <li aria-hidden={false}>
                  <CutLine eliminationCount={eliminationCount} />
                </li>
              ) : null}
            </Fragment>
          ))}
        </ol>
      </Panel>

      <p className="text-faint mt-6 text-center text-[12px] leading-relaxed">
        Under {formatCount(season.minSampleImpressions)} qualified views, products show as
        Collecting Data and are not ranked yet.{" "}
        <Link href="/how-it-works" className="text-primary hover:text-primary/80">
          How scoring works
        </Link>
      </p>
    </div>
  );
}

function Row({ row, eliminated }: { row: StandingRow; eliminated: boolean }) {
  const movement = rankMovement(row);

  return (
    <div
      className={cn(
        "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors",
        "md:grid-cols-[3rem_1fr_6rem_6rem_6rem_9rem]",
        eliminated ? "bg-danger/4" : "hover:bg-muted/60",
      )}
    >
      {/* Rank + movement */}
      <div className="flex items-center gap-1.5">
        {row.rank === 1 ? (
          <span className="mono flex size-6 items-center justify-center rounded-md border border-amber-400/50 bg-amber-50 text-[11px] font-bold text-amber-700 shadow-xs dark:bg-amber-950/60 dark:text-amber-300">
            01
          </span>
        ) : row.rank === 2 ? (
          <span className="mono flex size-6 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-[11px] font-bold text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            02
          </span>
        ) : row.rank === 3 ? (
          <span className="mono flex size-6 items-center justify-center rounded-md border border-amber-600/40 bg-orange-50 text-[11px] font-bold text-amber-800 shadow-xs dark:bg-amber-950/40 dark:text-amber-400">
            03
          </span>
        ) : (
          <span
            className={cn(
              "mono text-sm font-semibold",
              eliminated ? "text-danger" : "text-foreground",
            )}
          >
            {row.rank ? (row.rank < 10 ? `0${row.rank}` : row.rank) : "—"}
          </span>
        )}
        {movement ? (
          <span
            className={cn("num text-[10px] font-medium", movement > 0 ? "text-safe" : "text-danger")}
            title={`${movement > 0 ? "Up" : "Down"} ${Math.abs(movement)} since the last snapshot`}
          >
            {movement > 0 ? "▲" : "▼"}
            {Math.abs(movement)}
          </span>
        ) : null}
      </div>

      {/* Product */}
      <div className="min-w-0">
        <a
          href={`/go/${row.product.slug}`}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="hover:text-primary block min-h-11 content-center truncate text-sm font-medium transition-colors"
        >
          {row.product.name}
        </a>
        <div className="text-faint mt-0.5 flex items-center gap-1.5 truncate text-[12px]">
          {/* A dot rather than a filled chip: 32 tinted pills would fight the
              numbers, which are what this table is for. */}
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: CATEGORY_COLORS[row.product.category].ink }}
          />
          <span style={{ color: CATEGORY_COLORS[row.product.category].ink }}>
            {CATEGORY_LABELS[row.product.category]}
          </span>
          <span aria-hidden>&middot;</span>
          <span className="truncate">{row.product.tagline}</span>
        </div>
      </div>

      {/* Interest rate: always visible, it is the ranking number. */}
      <div className="text-right md:contents">
        <div className="md:text-right">
          <span
            className={cn(
              "num text-sm font-semibold",
              row.collecting && "text-subtle",
              eliminated && !row.collecting && "text-danger",
            )}
          >
            {row.collecting ? "—" : formatInterestRate(row.interestRate)}
          </span>
        </div>
        <div className="num text-subtle hidden text-right text-[13px] md:block">
          {formatCount(row.qualifiedImpressions)}
        </div>
        <div className="num text-subtle hidden text-right text-[13px] md:block">
          {formatCount(row.verifiedVisits)}
        </div>
        <div className="mt-1 flex justify-end md:mt-0">
          <StatusChip status={row.status} />
        </div>
      </div>
    </div>
  );
}

/**
 * The elimination boundary. The PRD asks for this to be extremely obvious, so
 * it is a full-bleed band rather than a rule between two rows.
 */
function CutLine({ eliminationCount }: { eliminationCount: number }) {
  return (
    <div className="bg-danger/8 border-danger/25 flex items-center gap-3 border-y px-4 py-2">
      <span className="bg-danger/30 h-px flex-1" aria-hidden />
      <span className="label text-danger whitespace-nowrap">
        Cut line &mdash; bottom {eliminationCount} eliminated at zero
      </span>
      <span className="bg-danger/30 h-px flex-1" aria-hidden />
    </div>
  );
}
