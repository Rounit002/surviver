import { CATEGORY_LABELS } from "@/lib/competition/constants";
import { getPublicUpcomingEntries } from "@/lib/competition/season";
import { displayHost, formatCount, formatRelative } from "@/lib/format";
import { createInteractionProof } from "@/lib/security/tokens";
import { getVisitorContext } from "@/lib/tracking/visitor";
import type { ProductCategory } from "@/generated/prisma";
import { LineupCard } from "./LineupCard";

/**
 * The lineup while the field fills: every paid product, as a card.
 *
 * Each card leads with the product's own words — its tagline — on a pastel
 * taken from its logo, with clicks underneath. Order is the order spots were
 * claimed.
 */
export async function UpcomingProductList({ seasonId, capacity, category }: { seasonId: string; capacity: number; category?: ProductCategory }) {
  const [entries, visitor] = await Promise.all([getPublicUpcomingEntries(seasonId, category), getVisitorContext()]);
  if (!entries.length) return null;

  const totalClicks = entries.reduce((sum, entry) => sum + entry._count.lineupClicks, 0);

  return (
    <section aria-labelledby="upcoming-products-heading" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="upcoming-products-heading" className="text-xl font-semibold">In the lineup</h2>
          <p className="text-subtle mt-1 text-sm">
            <span className="num text-foreground font-semibold">{entries.length}</span> of {capacity} in ·{" "}
            <span className="num text-foreground font-semibold">{formatCount(totalClicks)}</span> {totalClicks === 1 ? "click" : "clicks"} so far
          </p>
        </div>
      </div>

      <ul className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(({ id, product, createdAt, _count }, index) => (
          <li key={id}>
            <LineupCard
              data={{
                href: `/go/${product.slug}?proof=${encodeURIComponent(createInteractionProof(id, visitor))}`,
                name: product.name,
                host: displayHost(product.url),
                url: product.url,
                logoUrl: product.logoUrl,
                tagline: product.tagline || product.description,
                category: CATEGORY_LABELS[product.category],
                clicks: _count.lineupClicks,
                joined: `joined ${formatRelative(createdAt)}`,
                spot: index + 1,
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
