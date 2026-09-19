import { ImpressionTracker } from "./ImpressionTracker";
import { StatusChip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/competition/constants";
import type { StandingRow } from "@/lib/competition/standings";
import { displayHost, formatCount, formatInterestRate } from "@/lib/format";
import { createInteractionProof, type InteractionIdentity } from "@/lib/security/tokens";
import { SiteFavicon } from "./SiteFavicon";

/**
 * A contestant on the discovery board.
 *
 * The Interest Rate is the loudest thing on the card because it is the only
 * number that decides anything. Rank is present but deliberately quieter: the
 * board is not sorted by it, and leading with rank would imply it is.
 */
export function ProductCard({
  row,
  roundName,
  className,
  visitor,
}: {
  row: StandingRow;
  roundName?: string;
  className?: string;
  visitor: InteractionIdentity;
}) {
  const { product } = row;
  const host = displayHost(product.url);
  const interactionProof = createInteractionProof(row.entryId, visitor);
  const rank = row.rank;

  // Podium styling matching outbid.lol's top 3 highlights
  const isRank1 = rank === 1;
  const isRank2 = rank === 2;
  const isRank3 = rank === 3;

  const podiumBorder = isRank1
    ? "border-amber-400/40 bg-gradient-to-r from-amber-500/[0.03] to-surface shadow-[0_2px_12px_rgba(245,158,11,0.06)]"
    : isRank2
      ? "border-slate-300/60 bg-gradient-to-r from-slate-400/[0.03] to-surface"
      : isRank3
        ? "border-amber-700/30 bg-gradient-to-r from-amber-700/[0.02] to-surface"
        : "border-border bg-surface hover:border-primary/40";

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-[16px] border p-4 transition-all duration-150 sm:p-5",
        podiumBorder,
        className,
      )}
      data-entry-id={row.entryId}
    >
      <ImpressionTracker entryId={row.entryId} proof={interactionProof} />

      <div className="flex items-start gap-3 sm:gap-4">
        {/* Rank column - outbid.lol tabular podium indicator */}
        <div className="flex shrink-0 items-center justify-center pt-1">
          {isRank1 ? (
            <span
              className="mono flex size-7 items-center justify-center rounded-lg border border-amber-400/50 bg-amber-50 text-xs font-bold text-amber-700 shadow-xs dark:bg-amber-950/60 dark:text-amber-300"
              title="Rank #1"
            >
              01
            </span>
          ) : isRank2 ? (
            <span
              className="mono flex size-7 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-xs font-bold text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              title="Rank #2"
            >
              02
            </span>
          ) : isRank3 ? (
            <span
              className="mono flex size-7 items-center justify-center rounded-lg border border-amber-600/40 bg-orange-50 text-xs font-bold text-amber-800 shadow-xs dark:bg-amber-950/40 dark:text-amber-400"
              title="Rank #3"
            >
              03
            </span>
          ) : rank ? (
            <span className="mono text-faint flex size-7 items-center justify-center text-xs font-medium">
              {rank < 10 ? `0${rank}` : rank}
            </span>
          ) : (
            <span className="mono text-faint flex size-7 items-center justify-center text-xs">
              &mdash;
            </span>
          )}
        </div>

        {/* Product logo / monogram */}
        <SiteFavicon name={product.name} siteUrl={product.url} logoUrl={product.logoUrl} />

        {/* Product details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-foreground text-[15px] font-semibold leading-tight tracking-tight">
              {product.name}
            </h3>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: CATEGORY_COLORS[product.category].tint,
                color: CATEGORY_COLORS[product.category].ink,
              }}
            >
              {CATEGORY_LABELS[product.category]}
            </span>
            <span className="text-faint mono text-[12px]">{host}</span>
          </div>

          <p className="text-subtle mt-1 line-clamp-2 text-sm leading-relaxed">
            {product.tagline || product.description}
          </p>
        </div>

        {/* Performance Metric - Interest Rate */}
        <div className="shrink-0 text-right">
          {row.collecting ? (
            <div className="flex flex-col items-end">
              <span className="mono text-subtle text-sm font-semibold">&mdash;</span>
              <span className="label text-faint mt-0.5 text-[10px]">Collecting</span>
            </div>
          ) : (
            <div className="flex flex-col items-end">
              <span className="num text-foreground text-lg font-bold sm:text-xl">
                {formatInterestRate(row.interestRate)}
              </span>
              <span className="label text-faint mt-0.5 text-[10px]">Interest Rate</span>
            </div>
          )}
        </div>
      </div>

      {/* Row bottom action bar & stats */}
      <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="text-faint flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>
            <strong className="num text-foreground font-medium">{formatCount(row.verifiedVisits)}</strong>{" "}
            {row.verifiedVisits === 1 ? "visit" : "visits"}
          </span>
          <span aria-hidden>&middot;</span>
          <span>
            <strong className="num text-foreground font-medium">{formatCount(row.qualifiedImpressions)}</strong>{" "}
            views
          </span>
          {roundName ? (
            <>
              <span aria-hidden>&middot;</span>
              <span className="text-subtle font-medium">{roundName}</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5">
          <StatusChip status={row.status} />

          <a
            href={`/go/${product.slug}?proof=${encodeURIComponent(interactionProof)}`}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="border-border/80 hover:border-primary/50 hover:bg-primary-soft hover:text-primary inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-all duration-150"
          >
            <span>Visit</span>
            <span aria-hidden className="text-[11px]">&rarr;</span>
          </a>
        </div>
      </div>
    </article>
  );
}
