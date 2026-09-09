import type { Metadata } from "next";
import Link from "next/link";
import { RoundBar } from "@/components/competition/RoundBar";
import { ProductCard } from "@/components/product/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { CATEGORY_LABELS } from "@/lib/competition/constants";
import { getActiveRound, getCurrentSeason } from "@/lib/competition/season";
import { getStandings, balanceForVisitor } from "@/lib/competition/standings";
import { getVisitorContext } from "@/lib/tracking/visitor";
import type { ProductCategory } from "@/generated/prisma";

export const metadata: Metadata = {
  title: "Discovery board",
  description: "Every product competing this season. Browse, and visit the ones worth a look.",
};

export const dynamic = "force-dynamic";

export default async function BoardPage(props: PageProps<"/board">) {
  const season = await getCurrentSeason();
  if (!season) return <EmptyBoard reason="No season has been created yet." />;

  const round = await getActiveRound(season.id);
  const standings = await getStandings(season, round);
  if (standings.rows.length === 0) {
    return <EmptyBoard reason="No contestants on the board yet." />;
  }

  const params = await props.searchParams;
  const rawCategory = typeof params.category === "string" ? params.category : undefined;
  const activeCategory =
    rawCategory && rawCategory in CATEGORY_LABELS ? (rawCategory as ProductCategory) : null;

  const visitor = await getVisitorContext();
  const serverNow = new Date().toISOString();

  // Order is randomised per visitor: the board must never be sorted by
  // performance, or leaders would compound their own exposure (PRD 12).
  const shuffled = balanceForVisitor(standings.rows, `${visitor.visitorId}:${round?.id ?? ""}`, season);
  const visible = activeCategory
    ? shuffled.filter((row) => row.product.category === activeCategory)
    : shuffled;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-4">
      <header className="text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">The board</h1>
        <p className="text-subtle mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-pretty">
          Same entry fee, same starting exposure. The ones you choose to visit are the ones
          that survive.
        </p>
      </header>

      <div className="mt-7">
        <RoundBar
          season={season}
          round={round}
          competing={standings.rows.length}
          serverNow={serverNow}
        />
      </div>

      {visible.length === 0 ? (
        <Panel className="mt-6 px-6 py-14 text-center">
          <p className="text-subtle text-sm">No contestants in that category this season.</p>
          <div className="mt-4">
            <ButtonLink href="/board" variant="secondary" size="sm">
              Show all
            </ButtonLink>
          </div>
        </Panel>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3">
          {visible.map((row) => (
            <ProductCard key={row.entryId} row={row} roundName={round?.name} />
          ))}
        </div>
      )}

      <p className="text-faint mt-8 text-center text-[12px] leading-relaxed">
        Paid placements, ordered to balance views for every visitor. Ranking cannot be purchased.{" "}
        <Link href="/how-it-works" className="text-primary hover:text-primary/80">
          How scoring works
        </Link>
      </p>
    </div>
  );
}

function EmptyBoard({ reason }: { reason: string }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-4">
      <header className="text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">The board</h1>
      </header>
      <Panel className="mt-8 px-6 py-16 text-center">
        <p className="text-subtle text-sm">{reason}</p>
        <div className="mt-5">
          <ButtonLink href="/enter" variant="primary" size="sm">
            Enter the next season
          </ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
