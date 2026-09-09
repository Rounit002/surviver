import { ImpressionTracker } from "./ImpressionTracker";
import { StatusChip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/competition/constants";
import type { StandingRow } from "@/lib/competition/standings";
import { displayHost, formatCount, formatInterestRate } from "@/lib/format";
import type { ProductCategory } from "@/generated/prisma";

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
}: {
  row: StandingRow;
  roundName?: string;
  className?: string;
}) {
  const { product } = row;
  const host = displayHost(product.url);

  return (
    <article
      className={cn(
        "group border-border bg-surface hover:border-primary/30 flex flex-col rounded-3xl border p-5 transition-colors",
        className,
      )}
      data-entry-id={row.entryId}
    >
      <ImpressionTracker entryId={row.entryId} />
      <div className="flex items-start gap-3">
        <Monogram
          name={product.name}
          logoUrl={product.logoUrl}
          category={product.category}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-[15px] leading-tight font-semibold">{product.name}</h3>
            {row.rank ? (
              <span className="label text-faint shrink-0">#{row.rank}</span>
            ) : null}
          </div>
          <p className="text-subtle mt-0.5 truncate text-[13px]">{product.tagline}</p>
        </div>

        <div className="shrink-0 text-right">
          {row.collecting ? (
            <>
              <div className="num text-subtle text-[15px] leading-none font-semibold">&mdash;</div>
              <div className="label mt-1.5">Collecting</div>
            </>
          ) : (
            <>
              <div className="num text-[22px] leading-none font-semibold">
                {formatInterestRate(row.interestRate)}
              </div>
              <div className="label mt-1.5">Interest rate</div>
            </>
          )}
        </div>
      </div>

      <p className="text-subtle mt-3.5 line-clamp-3 text-[13px] leading-relaxed">
        {product.description}
      </p>

      <div className="text-faint mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
        <span
          className="rounded-full px-2 py-0.5 font-medium"
          style={{
            backgroundColor: CATEGORY_COLORS[product.category].tint,
            color: CATEGORY_COLORS[product.category].ink,
          }}
        >
          {CATEGORY_LABELS[product.category]}
        </span>
        {roundName ? (
          <>
            <span aria-hidden>&middot;</span>
            <span>{roundName}</span>
          </>
        ) : null}
        <span aria-hidden>&middot;</span>
        <span className="mono">{host}</span>
        <span aria-hidden>&middot;</span>
        <span>
          <span className="num">{formatCount(row.verifiedVisits)}</span> visits
        </span>
        <span aria-hidden>&middot;</span>
        <span>
          <span className="num">{formatCount(row.qualifiedImpressions)}</span> views
        </span>
      </div>

      <div className="border-border mt-4 flex items-center justify-between gap-3 border-t pt-4">
        <a
          href={`/go/${product.slug}`}
          target="_blank"
          // Paid placement: never pass ranking signal to the destination.
          rel="noopener noreferrer nofollow sponsored"
          className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
        >
          Visit {product.name}
          <span aria-hidden>&rarr;</span>
        </a>

        <StatusChip status={row.status} />
      </div>
    </article>
  );
}

/**
 * Falls back to a monogram tile tinted by category, so a wall of cards reads
 * as a set of groups rather than one undifferentiated grid.
 */
function Monogram({
  name,
  logoUrl,
  category,
}: {
  name: string;
  logoUrl: string | null;
  category: ProductCategory;
}) {
  if (logoUrl) {
    return (
      // Product logos are arbitrary remote URLs, so this stays a plain img
      // rather than next/image, which would need every host allow-listed.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={40}
        height={40}
        className="border-border size-10 shrink-0 rounded-md border object-cover"
      />
    );
  }

  const { tint, ink } = CATEGORY_COLORS[category];

  return (
    <div
      aria-hidden
      style={{ backgroundColor: tint, color: ink }}
      className="flex size-10 shrink-0 items-center justify-center rounded-md text-[15px] font-semibold"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
