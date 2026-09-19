import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/competition/constants";
import { getPublicUpcomingEntries } from "@/lib/competition/season";
import { displayHost } from "@/lib/format";

/** Public preview only: these entries are paid and approved, but not competing yet. */
export async function UpcomingProductList({ seasonId }: { seasonId: string }) {
  const entries = await getPublicUpcomingEntries(seasonId);
  if (!entries.length) return null;

  return (
    <section aria-labelledby="upcoming-products-heading" className="mt-8">
      <div className="mb-4 text-center">
        <p className="label label-bright">Paid and approved</p>
        <h2 id="upcoming-products-heading" className="text-heading mt-2 font-semibold">
          Waiting for the 35-product field
        </h2>
        <p className="text-subtle mt-2 text-sm">
          These products are listed now. Competition and round timing begin when the field is ready.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {entries.map(({ id, product }) => (
          <li key={id} className="border-border bg-surface rounded-[16px] border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-foreground truncate text-sm font-semibold">{product.name}</h3>
                <p className="text-faint mt-1 truncate text-xs">
                  {CATEGORY_LABELS[product.category]} · {displayHost(product.url)}
                </p>
              </div>
              <span className="label shrink-0 rounded-full border border-border px-2 py-1 text-faint">
                Upcoming
              </span>
            </div>
            <p className="text-subtle mt-3 line-clamp-2 text-sm">
              {product.tagline || product.description}
            </p>
            <Link
              href={`/go/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer nofollow sponsored"
              className="text-primary mt-4 inline-flex text-xs font-semibold hover:underline"
            >
              Visit product <span aria-hidden className="ml-1">&rarr;</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
