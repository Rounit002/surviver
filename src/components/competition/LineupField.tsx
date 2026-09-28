import { SiteFavicon } from "@/components/product/SiteFavicon";
import { Icon } from "@/components/ui/Icon";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/competition/constants";
import type { ProductCategory } from "@/generated/prisma";
import { EnterButton } from "@/components/entry/EnterButton";

export type LineupEntry = {
  id: string;
  /** The tracked outbound link, carrying this visitor's click proof. */
  href: string;
  slug: string;
  name: string;
  url: string;
  logoUrl: string | null;
  category: ProductCategory;
};

/**
 * The season's field, drawn as its 32 slots.
 *
 * This is the format in one picture: the spots fill with real products (each
 * in its category colour), a hatched slot is being paid for right now, and a
 * dashed one is open. Ranking starts when the last one fills — so the picture
 * also says what everyone is waiting for.
 */
export function LineupField({
  seasonName,
  entries,
  capacity,
  held,
  open,
}: {
  seasonName: string;
  entries: LineupEntry[];
  capacity: number;
  held: number;
  open: boolean;
}) {
  const filled = Math.min(entries.length, capacity);
  const remaining = Math.max(0, capacity - filled);
  const pct = Math.round((filled / capacity) * 100);

  return (
    <div className="border-border bg-surface/90 shadow-showcase rounded-[24px] border p-4 backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-subtle text-xs font-semibold tracking-wide uppercase">{seasonName} lineup</p>
          <p className="mt-1 text-lg font-semibold sm:text-xl">
            <span className="num text-primary">{filled}</span>
            <span className="text-subtle"> / {capacity} spots filled</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="bg-accent-soft text-accent rounded-full px-2.5 py-1">
            {remaining === 0 ? "Field complete" : `Ranking starts at ${capacity}`}
          </span>
        </div>
      </div>

      <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full" role="progressbar" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={capacity} aria-label="Spots filled">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(pct, 2)}%`,
            background: "linear-gradient(90deg, var(--color-primary), color-mix(in oklab, var(--color-primary) 55%, var(--color-accent)))",
          }}
        />
      </div>

      <ul className="mt-5 grid grid-cols-8 gap-1.5 sm:gap-2 md:grid-cols-16">
        {Array.from({ length: capacity }, (_, index) => {
          const entry = entries[index];
          if (entry) {
            const colors = CATEGORY_COLORS[entry.category];
            return (
              <li key={entry.id}>
                <a
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  title={`${entry.name} · ${CATEGORY_LABELS[entry.category]}`}
                  className="group relative flex aspect-square items-center justify-center rounded-[10px] transition-transform duration-200 hover:-translate-y-0.5 hover:scale-105"
                  style={{ backgroundColor: colors.tint, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${colors.ink} 22%, transparent)` }}
                >
                  <SiteFavicon name={entry.name} siteUrl={entry.url} logoUrl={entry.logoUrl} className="size-[62%] rounded-[7px] border-0 bg-transparent" />
                  <span className="sr-only">{entry.name}</span>
                </a>
              </li>
            );
          }
          const isHeld = index < filled + held;
          return (
            <li key={`slot-${index}`}>
              {isHeld ? (
                <span className="slot-held border-accent/30 flex aspect-square rounded-[10px] border" title="Being checked out" />
              ) : open ? (
                <EnterButton
                  className="group border-border-strong text-subtle/60 hover:border-primary hover:text-primary hover:bg-primary-soft flex aspect-square items-center justify-center rounded-[10px] border border-dashed transition-all duration-150 hover:scale-105 hover:border-solid"
                  aria-label={`Claim spot ${index + 1}`}
                  title="Claim this spot"
                >
                  <Icon name="plus" width={16} strokeWidth={2.25} className="transition-transform duration-150 group-hover:rotate-90" />
                </EnterButton>
              ) : (
                <span className="border-border flex aspect-square rounded-[10px] border border-dashed" />
              )}
            </li>
          );
        })}
      </ul>

      <div className="text-subtle mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="inline-flex items-center gap-1.5"><span className="bg-primary-soft border-primary/30 size-3 rounded-[4px] border" />Taken</span>
        {held ? <span className="inline-flex items-center gap-1.5"><span className="slot-held border-accent/30 size-3 rounded-[4px] border" />In checkout</span> : null}
        <span className="inline-flex items-center gap-1.5"><span className="border-border-strong size-3 rounded-[4px] border border-dashed" />Open</span>
        {open && remaining > 0 ? (
          <EnterButton className="btn-primary text-primary-foreground ml-auto inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-xs font-semibold transition-[filter] hover:brightness-110">
            <Icon name="plus" width={14} strokeWidth={2.5} />
            Claim a spot
          </EnterButton>
        ) : null}
      </div>
    </div>
  );
}
