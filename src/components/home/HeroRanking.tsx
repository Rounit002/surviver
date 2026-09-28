import Link from "next/link";
import { SiteFavicon } from "@/components/product/SiteFavicon";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { StandingRow } from "@/lib/competition/standings";
import { formatCount } from "@/lib/format";

/**
 * The hero's right-hand picture: the board as it looks once a season is live.
 *
 * While a season is running it shows the real top four and their real clicks.
 * Before that it is an illustration — abstract rows with no names and no
 * figures — because inventing a ranking for products that have not competed
 * would be a false claim about real entrants.
 */
export function HeroRanking({ rows, live }: { rows: StandingRow[]; live: boolean }) {
  const real = live && rows.length > 0;
  const top = rows.slice(0, 4);
  const maxClicks = Math.max(1, ...top.map((row) => row.verifiedVisits));
  const bars = [0.92, 0.74, 0.58, 0.41];

  return (
    <div className="relative">
      <div aria-hidden className="bg-foreground/5 absolute -inset-5 -z-10 rounded-[40px] blur-3xl" />
      <div className="border-border bg-surface shadow-showcase rounded-[28px] border p-5 sm:p-6">
        <div className="flex items-center justify-between px-1 pb-4">
          <span className="text-lg font-bold">Live ranking</span>
          {live ? (
            <span className="text-live inline-flex items-center gap-2 text-xs font-bold tracking-wide">
              <span className="pulse-dot bg-live size-2 rounded-full" />
              LIVE
            </span>
          ) : (
            <span className="bg-muted text-subtle rounded-full px-2.5 py-1 text-xs font-semibold">Starts at 32</span>
          )}
        </div>

        <ol className="space-y-2.5">
          {(real ? top : bars).map((item, i) => {
            const row = real ? (item as StandingRow) : null;
            const width = row ? row.verifiedVisits / maxClicks : (item as number);
            const rising = row ? row.prevRank !== null && row.rank !== null && row.rank < row.prevRank : i === 1;
            return (
              <li
                key={row?.entryId ?? i}
                className={cn(
                  "flex items-center gap-3 rounded-[18px] border p-3 sm:gap-3.5 sm:p-3.5",
                  i === 0 ? "border-border-strong bg-elevated" : "bg-muted/50 border-transparent",
                )}
              >
                <span className={cn("mono flex size-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-bold", i === 0 ? "bg-foreground text-surface" : "bg-muted-strong text-subtle")}>
                  {String(row?.rank ?? i + 1).padStart(2, "0")}
                </span>
                {row ? (
                  <SiteFavicon name={row.product.name} siteUrl={row.product.url} logoUrl={row.product.logoUrl} />
                ) : (
                  <span className="bg-surface border-border flex size-10 shrink-0 items-center justify-center rounded-[11px] border">
                    <span className="bg-primary size-3.5 rounded-[4px] opacity-80" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {row ? (
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{row.product.name}</span>
                      <span className="num text-subtle shrink-0 text-xs">{formatCount(row.verifiedVisits)} clicks</span>
                    </div>
                  ) : (
                    <span className="bg-foreground/80 block h-2.5 rounded-full" style={{ width: `${62 - i * 6}%` }} />
                  )}
                  <span className="bg-muted-strong mt-2.5 block h-2 overflow-hidden rounded-full">
                    <span className="bg-primary block h-full rounded-full" style={{ width: `${Math.max(4, width * 100)}%` }} />
                  </span>
                </div>
                {rising ? (
                  <span className="bg-primary-soft text-primary flex shrink-0 items-center rounded-full px-2 py-1" title="Rising">
                    <svg width="11" height="9" viewBox="0 0 14 12" aria-hidden><path d="M7 0L14 12H0z" fill="currentColor" /></svg>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        {real ? (
          <Link href="/leaderboard" className="text-primary mt-4 inline-flex items-center gap-1 px-1 text-xs font-semibold hover:underline">
            Full leaderboard <Icon name="arrow" width="12" height="12" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
