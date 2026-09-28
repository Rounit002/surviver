import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { RoundBar } from "@/components/competition/RoundBar";
import { SiteFavicon } from "@/components/product/SiteFavicon";
import { buttonClass } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { CATEGORY_COLORS, CATEGORY_LABELS, FIELD_SIZE } from "@/lib/competition/constants";
import { getActiveRound, getCurrentSeason, getOpenSeason, getSeasonSummary } from "@/lib/competition/season";
import { getStandings, rankMovement, type StandingRow } from "@/lib/competition/standings";
import { formatCount } from "@/lib/format";
import { EnterButton } from "@/components/entry/EnterButton";

export const metadata = pageMetadata("/leaderboard");

export const dynamic = "force-dynamic";

const PODIUM: Record<number, string> = {
  1: "bg-amber-50 text-amber-700 border-amber-300/70 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60",
  2: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  3: "bg-orange-50 text-orange-800 border-orange-300/70 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60",
};

export default async function LeaderboardPage() {
  const season = await getCurrentSeason();
  const round = season ? await getActiveRound(season.id) : null;
  const standings = season ? await getStandings(season, round) : { rows: [] as StandingRow[] };

  if (!season || standings.rows.length === 0) {
    const open = await getOpenSeason();
    const summary = open ? await getSeasonSummary(open) : null;
    const claimed = summary?.claimed ?? 0;
    const capacity = open?.capacity ?? FIELD_SIZE;
    return (
      <div className="shell section">
        <header>
          <p className="eyebrow">Leaderboard</p>
          <h1 className="text-title mt-3 font-semibold">Ranked by real clicks.</h1>
        </header>
        <div className="border-border bg-surface mt-8 overflow-hidden rounded-[20px] border">
          <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-lg font-semibold">Goes live when all {capacity} spots are filled.</p>
              <p className="text-subtle mt-1.5 text-sm">
                <span className="num text-foreground font-semibold">{claimed}</span> of {capacity} entered so far.
              </p>
              <div className="bg-muted mt-5 h-2 max-w-md overflow-hidden rounded-full">
                <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, (claimed / capacity) * 100)}%` }} />
              </div>
            </div>
            <EnterButton className={buttonClass("primary", "md")}>
              Claim a spot
              <Icon name="arrow" width="15" height="15" />
            </EnterButton>
          </div>
          <FillGrid claimed={claimed} capacity={capacity} />
        </div>
      </div>
    );
  }

  const serverNow = new Date().toISOString();
  const { rows } = standings;

  return (
    <div className="shell section">
      <header>
        <p className="eyebrow">Leaderboard</p>
        <h1 className="text-title mt-3 font-semibold">Ranked by real clicks.</h1>
      </header>

      <div className="mt-8">
        <RoundBar season={season} round={round} competing={rows.length} serverNow={serverNow} />
      </div>

      <div className="border-border bg-surface mt-4 overflow-hidden rounded-[20px] border">
        <div className="border-border text-subtle hidden border-b px-5 py-3 md:grid md:grid-cols-[3.5rem_1fr_7rem_7rem_8rem] md:items-center md:gap-3">
          <div className="label">Rank</div>
          <div className="label">Product</div>
          <div className="label text-right">Clicks</div>
          <div className="label text-right">Views</div>
          <div className="label text-right">Status</div>
        </div>
        <ol className="divide-border divide-y">
          {rows.map((row) => (
            <li key={row.entryId}>
              <Row row={row} />
            </li>
          ))}
        </ol>
      </div>

      <p className="text-subtle mt-5 text-xs">
        One click per visitor per product. Nobody is cut.{" "}
        <Link href="/how-it-works" className="text-primary hover:underline">
          How it works
        </Link>
      </p>
    </div>
  );
}

function Row({ row }: { row: StandingRow }) {
  const movement = rankMovement(row);
  const podium = row.rank ? PODIUM[row.rank] : undefined;

  return (
    <div
      className={cn(
        "hover:bg-muted/50 grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors sm:px-5",
        "md:grid-cols-[3.5rem_1fr_7rem_7rem_8rem]",
        row.rank === 1 && "bg-amber-50/40 dark:bg-amber-950/10",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "mono flex size-8 items-center justify-center rounded-[9px] text-xs font-bold",
            podium ? cn("border", podium) : "text-subtle",
          )}
        >
          {row.rank ? String(row.rank).padStart(2, "0") : "—"}
        </span>
        {movement ? (
          <span
            className={cn("num text-[10px] font-semibold", movement > 0 ? "text-live" : "text-subtle")}
            title={`${movement > 0 ? "Up" : "Down"} ${Math.abs(movement)}`}
          >
            {movement > 0 ? "▲" : "▼"}
            {Math.abs(movement)}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <SiteFavicon name={row.product.name} siteUrl={row.product.url} logoUrl={row.product.logoUrl} />
        <div className="min-w-0">
          <a
            href={`/go/${row.product.slug}`}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="hover:text-primary block truncate text-sm font-semibold transition-colors"
          >
            {row.product.name}
          </a>
          <div className="text-subtle mt-0.5 flex items-center gap-1.5 truncate text-xs">
            <span
              className="rounded-full px-1.5 py-px text-[10px] font-medium"
              style={{ backgroundColor: CATEGORY_COLORS[row.product.category].tint, color: CATEGORY_COLORS[row.product.category].ink }}
            >
              {CATEGORY_LABELS[row.product.category]}
            </span>
            <span className="truncate">{row.product.tagline}</span>
          </div>
        </div>
      </div>

      <div className="text-right md:contents">
        <div className="md:text-right">
          <span className="num text-base font-bold">{formatCount(row.verifiedVisits)}</span>
          <span className="text-subtle ml-1 text-xs md:hidden">clicks</span>
        </div>
        <div className="num text-subtle hidden text-right text-[13px] md:block">
          {formatCount(row.qualifiedImpressions)}
        </div>
        <div className="mt-1 hidden justify-end md:mt-0 md:flex">
          <StatusChip status={row.status} />
        </div>
      </div>
    </div>
  );
}

/** 32 slots, filled in as spots are bought — the waiting state, made visible. */
function FillGrid({ claimed, capacity }: { claimed: number; capacity: number }) {
  return (
    <div className="border-border bg-muted/40 grid grid-cols-8 gap-1.5 border-t p-4 sm:grid-cols-16 sm:gap-2 sm:p-6">
      {Array.from({ length: capacity }, (_, i) => (
        <span
          key={i}
          className={cn(
            "aspect-square rounded-[6px]",
            i < claimed ? "bg-primary" : "border-border bg-surface border border-dashed",
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}
