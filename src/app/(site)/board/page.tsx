import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { CategoryBar } from "@/components/layout/CategoryBar";
import { RoundBar } from "@/components/competition/RoundBar";
import { ProductCard } from "@/components/product/ProductCard";
import { UpcomingProductList } from "@/components/product/UpcomingProductList";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { CATEGORY_LABELS } from "@/lib/competition/constants";
import { getActiveRound, getCurrentSeason, getOpenSeason } from "@/lib/competition/season";
import { getStandings, balanceForVisitor } from "@/lib/competition/standings";
import { getVisitorContext } from "@/lib/tracking/visitor";
import type { ProductCategory } from "@/generated/prisma";
import { EnterButton } from "@/components/entry/EnterButton";

export const metadata = pageMetadata("/board");

export const dynamic = "force-dynamic";

export default async function BoardPage(props: PageProps<"/board">) {
  const [season, openSeason] = await Promise.all([getCurrentSeason(), getOpenSeason()]);
  if (!season) return <EmptyBoard reason="No season has been created yet." />;

  const round = await getActiveRound(season.id);
  const standings = await getStandings(season, round);
  const listingSeason = openSeason ?? (season.status === "REGISTRATION_CLOSED" ? season : null);
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
    <div className="shell section">
      <header>
        <h1 className="text-title font-semibold">The board</h1>
        <p className="text-subtle mt-2">Visit what interests you. Your visits decide who survives.</p>
      </header>

      <div className="mt-8">
        <CategoryBar />
      </div>

      <div className="mt-6">
        <RoundBar
          season={season}
          round={round}
          competing={standings.rows.length}
          serverNow={serverNow}
        />
      </div>

      {standings.rows.length === 0 ? (
        <div className="border-border text-subtle mt-6 rounded-[16px] border border-dashed px-6 py-10 text-center text-sm">
          Competition hasn’t started yet.
        </div>
      ) : null}

      {listingSeason ? <UpcomingProductList seasonId={listingSeason.id} capacity={listingSeason.capacity} category={activeCategory ?? undefined} /> : null}

      {visible.length === 0 && standings.rows.length > 0 ? (
        <Panel className="mt-6 px-6 py-14 text-center">
          <p className="text-subtle text-sm">No contestants in that category this season.</p>
          <div className="mt-4">
            <ButtonLink href="/board" variant="secondary" size="sm">
              Show all
            </ButtonLink>
          </div>
        </Panel>
      ) : visible.length ? (
        <div className="mt-6 grid grid-cols-1 gap-2.5">
          <h2 className="sr-only">Competing products</h2>
          {visible.map((row) => (
            <ProductCard key={row.entryId} row={row} visitor={visitor} />
          ))}
        </div>
      ) : null}

      <p className="text-subtle mt-6 text-xs">
        Paid placements. Rank is earned, never bought.{" "}
        <Link href="/how-it-works" className="text-primary hover:underline">
          Scoring
        </Link>
      </p>
    </div>
  );
}

function EmptyBoard({ reason }: { reason: string }) {
  return (
    <div className="shell section">
      <header>
        <h1 className="text-title font-semibold">The board</h1>
      </header>
      <Panel className="mt-8 px-6 py-16 text-center">
        <p className="text-subtle text-sm">{reason}</p>
        <div className="mt-5">
          <EnterButton className={buttonClass("primary", "sm")}>
            Enter. Earn your spot.
          </EnterButton>
        </div>
      </Panel>
    </div>
  );
}
