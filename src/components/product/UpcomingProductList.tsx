import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Icon } from "@/components/ui/Icon";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/competition/constants";
import { getPublicUpcomingEntries } from "@/lib/competition/season";
import { displayHost, formatCount, formatRelative } from "@/lib/format";
import { createInteractionProof } from "@/lib/security/tokens";
import { getVisitorContext } from "@/lib/tracking/visitor";
import type { ProductCategory } from "@/generated/prisma";
import { SiteFavicon } from "./SiteFavicon";
import { SpotlightCard } from "./SpotlightCard";

/**
 * The lineup while the field fills: every paid product, as a card.
 *
 * The number that matters is clicks — how many people actually went to the
 * product — so it is the largest thing on the card, with a bar against the
 * most-clicked product in the lineup. Order is the order spots were claimed.
 */
export async function UpcomingProductList({ seasonId, capacity, category }: { seasonId: string; capacity: number; category?: ProductCategory }) {
  const [entries, visitor] = await Promise.all([getPublicUpcomingEntries(seasonId, category), getVisitorContext()]);
  if (!entries.length) return null;

  const clicks = entries.map((entry) => entry._count.lineupClicks);
  const maxClicks = Math.max(0, ...clicks);
  const totalClicks = clicks.reduce((sum, n) => sum + n, 0);

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

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(({ id, product, createdAt, _count }, index) => {
          const colors = CATEGORY_COLORS[product.category];
          const productClicks = _count.lineupClicks;
          const proof = createInteractionProof(id, visitor);
          return (
            <li key={id}>
              <SpotlightCard
                href={`/go/${product.slug}?proof=${encodeURIComponent(proof)}`}
                glow={colors.ink}
                label={`Visit ${product.name}`}
                className="h-full"
              >
                {/* Cover: the category's colour, its mark, and the spot number. */}
                <div className="cover-dots relative h-20 shrink-0" style={{ backgroundColor: colors.tint, color: colors.ink }}>
                  <CategoryIcon
                    category={product.category}
                    width={72}
                    height={72}
                    className="absolute -right-2 -bottom-4 opacity-20 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                  />
                  <span className="bg-surface/85 text-foreground absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                    Spot <span className="num">{String(index + 1).padStart(2, "0")}</span>
                  </span>
                </div>

                <div className="flex flex-1 flex-col px-5 pb-5">
                  <div className="relative z-10 -mt-7 flex items-end justify-between gap-3">
                    <SiteFavicon
                      name={product.name}
                      siteUrl={product.url}
                      logoUrl={product.logoUrl}
                      className="bg-surface ring-surface size-14 rounded-[16px] shadow-md ring-4"
                    />
                    <span
                      className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: colors.tint, color: colors.ink }}
                    >
                      <CategoryIcon category={product.category} width={12} height={12} />
                      {CATEGORY_LABELS[product.category]}
                    </span>
                  </div>

                  <h3 className="mt-3 truncate text-[17px] font-semibold">{product.name}</h3>
                  <p className="text-subtle mono truncate text-xs">{displayHost(product.url)}</p>
                  <p className="text-subtle mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed">
                    {product.tagline || product.description}
                  </p>

                  <div className="border-border mt-4 border-t pt-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="flex items-baseline gap-1.5">
                          <span className="num text-2xl leading-none font-bold">{formatCount(productClicks)}</span>
                          <span className="text-subtle text-xs font-medium">{productClicks === 1 ? "click" : "clicks"}</span>
                        </p>
                        <p className="text-subtle mt-1 text-[11px]">Joined {formatRelative(createdAt)}</p>
                      </div>
                      <span className="bg-foreground text-background inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3.5 text-xs font-semibold transition-[gap,transform] duration-200 group-hover:gap-2.5">
                        Visit
                        <Icon name="arrow" width={13} strokeWidth={2.5} />
                      </span>
                    </div>
                    <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full" aria-hidden>
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{
                          width: `${maxClicks ? Math.max(4, (productClicks / maxClicks) * 100) : 4}%`,
                          backgroundColor: colors.ink,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
