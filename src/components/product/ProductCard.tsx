import { ImpressionTracker } from "./ImpressionTracker";
import { StatusChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/competition/constants";
import type { StandingRow } from "@/lib/competition/standings";
import { displayHost, formatCount } from "@/lib/format";
import { createInteractionProof, type InteractionIdentity } from "@/lib/security/tokens";
import { SiteFavicon } from "./SiteFavicon";

/** Podium ranks get a tinted tile; everything else is a plain figure. */
const PODIUM: Record<number, string> = {
  1: "border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  2: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  3: "border-orange-300/60 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
};

/**
 * A contestant on the discovery board, as one scannable row.
 *
 * Left to right: rank, logo, who they are, what the numbers say, and the one
 * action. The Interest Rate is the loudest figure because it is the only
 * number that decides anything; the board is not sorted by rank, so rank
 * stays small.
 */
export function ProductCard({
  row,
  className,
  visitor,
}: {
  row: StandingRow;
  className?: string;
  visitor: InteractionIdentity;
}) {
  const { product } = row;
  const host = displayHost(product.url);
  const interactionProof = createInteractionProof(row.entryId, visitor);
  const rank = row.rank;
  const category = CATEGORY_COLORS[product.category];

  return (
    <article
      className={cn(
        "bg-surface hover:border-border-strong flex items-center gap-3 rounded-[14px] border p-3.5 transition-colors duration-150 sm:gap-4 sm:px-4",
        rank === 1 ? "border-amber-400/50" : "border-border",
        className,
      )}
      data-entry-id={row.entryId}
    >
      <ImpressionTracker entryId={row.entryId} proof={interactionProof} />

      <span
        className={cn(
          "mono flex size-7 shrink-0 items-center justify-center rounded-lg text-xs",
          rank && PODIUM[rank] ? cn("border font-bold", PODIUM[rank]) : "text-subtle font-medium",
        )}
        title={rank ? `Rank ${rank}` : "Not ranked yet"}
      >
        {rank ? String(rank).padStart(2, "0") : "—"}
      </span>

      <SiteFavicon name={product.name} siteUrl={product.url} logoUrl={product.logoUrl} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="truncate text-[15px] leading-tight font-semibold">{product.name}</h3>
          <span className="text-subtle mono hidden truncate text-xs sm:inline">{host}</span>
        </div>
        <p className="text-subtle mt-0.5 line-clamp-2 text-[13px] sm:line-clamp-1 sm:text-sm">
          {product.tagline || product.description}
        </p>
        <div className="text-subtle mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span
            className="rounded-full px-2 py-px text-[11px] font-medium"
            style={{ backgroundColor: category.tint, color: category.ink }}
          >
            {CATEGORY_LABELS[product.category]}
          </span>
          <span className="hidden sm:inline">
            <span className="num text-foreground font-medium">{formatCount(row.qualifiedImpressions)}</span>{" "}
            views
          </span>
        </div>
      </div>

      <div className="hidden shrink-0 md:block">
        <StatusChip status={row.status} />
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="text-right">
          <div className={cn("num text-lg leading-none font-bold", row.collecting && "text-subtle")}>
            {formatCount(row.verifiedVisits)}
          </div>
          <div className="label mt-1">{row.verifiedVisits === 1 ? "Click" : "Clicks"}</div>
        </div>

        <a
          href={`/go/${product.slug}?proof=${encodeURIComponent(interactionProof)}`}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          aria-label={`Visit ${product.name}`}
          className="bg-foreground text-background inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-xs font-semibold transition-opacity duration-150 hover:opacity-85"
        >
          Visit
          <Icon name="external" width="12" height="12" />
        </a>
      </div>
    </article>
  );
}
