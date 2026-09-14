import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { EntryForm } from "@/components/entry/EntryForm";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { getOpenSeason, CLAIMED_ENTRY_STATUSES } from "@/lib/competition/season";
import { CATEGORY_VALUES } from "@/lib/competition/constants";
import type { ProductCategory } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { formatCount, formatMoney } from "@/lib/format";
import { requireVerifiedUser } from "@/lib/auth/guards";
import { isDevPayments } from "@/lib/payments";

export const metadata = pageMetadata("/enter");

export const dynamic = "force-dynamic";

export default async function EnterPage(props: PageProps<"/enter">) {
  const user = await requireVerifiedUser("/enter");
  const params = await props.searchParams;
  const initialUrl = typeof params.url === "string" ? params.url.slice(0, 2048) : "";
  const initialCategory = typeof params.category === "string" && CATEGORY_VALUES.includes(params.category as ProductCategory) ? params.category as ProductCategory : "";
  const season = await getOpenSeason();

  if (!season) return <ClosedState />;

  const claimed = await prisma.seasonEntry.count({
    where: { seasonId: season.id, status: { in: CLAIMED_ENTRY_STATUSES } },
  });
  const remaining = Math.max(0, season.capacity - claimed);

  if (remaining === 0) return <ClosedState full seasonName={season.name} />;

  const price = formatMoney(season.entryPriceCents, season.currency);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 pb-4">
      <header className="text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">Enter {season.name}</h1>
        <p className="text-subtle mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-pretty">
          Paste your link, pick a category, and pay the flat fee using your verified account.
        </p>
      </header>

      {/* Three tiles rather than one flat rail: the price, the scarcity and the
          odds are different kinds of fact, so each gets its own card and its own
          colour instead of sharing a single grey line. */}
      <div className="mt-7 grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className="border-primary/20 bg-primary-soft rounded-lg border px-3 py-4 text-center">
          <div className="label text-primary">Entry</div>
          <div className="num text-primary mt-2 text-lg leading-none font-semibold sm:text-2xl">
            {price}
          </div>
          <div className="text-faint mt-1.5 text-[11px]">one flat fee</div>
        </div>

        <div className="border-border bg-muted rounded-lg border px-3 py-4 text-center">
          <div className="label">Slots left</div>
          <div className="num mt-2 text-lg leading-none font-semibold sm:text-2xl">
            {formatCount(remaining)}
            <span className="text-faint text-[13px]"> / {season.capacity}</span>
          </div>
          <div className="text-faint mt-1.5 text-[11px]">first come, first on</div>
        </div>

        <div className="border-danger/20 bg-danger/8 rounded-lg border px-3 py-4 text-center">
          <div className="label text-danger">Bracket</div>
          <div className="num text-danger mt-2 text-lg leading-none font-semibold sm:text-2xl">
            {season.capacity} &rarr; 1
          </div>
          <div className="text-faint mt-1.5 text-[11px]">one survivor</div>
        </div>
      </div>

      {isDevPayments() ? <p className="border-primary/20 bg-primary-soft text-primary mx-auto mt-4 w-fit rounded-full border px-3.5 py-1.5 text-center text-[12px]">Local test mode &mdash; checkout is simulated, no money is charged.</p> : null}

      <div className="mt-6">
        <EntryForm priceLabel={price} initialUrl={initialUrl} initialCategory={initialCategory} initialEmail={user.email} testMode={isDevPayments()} />
      </div>

      <p className="text-faint mt-6 text-center text-[12px] leading-relaxed">
        By entering you accept the{" "}
        <Link href="/rules" className="text-primary hover:text-primary/80">
          competition rules
        </Link>{" "}
        and{" "}
        <Link href="/rules#entry-fees" className="text-primary hover:text-primary/80">
          entry fee details
        </Link>
        .
      </p>
    </div>
  );
}

function ClosedState({ full = false, seasonName }: { full?: boolean; seasonName?: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 pb-4">
      <header className="text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          {full ? `${seasonName} is full` : "Registration is closed"}
        </h1>
      </header>
      <Panel className="mt-8 px-6 py-14 text-center">
        <p className="text-subtle mx-auto max-w-sm text-sm leading-relaxed">
          {full
            ? "Every slot in this season has been claimed. The next season opens once this one is under way."
            : "No season is taking entries right now. The next one opens shortly."}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <ButtonLink href="/board" variant="primary" size="sm">
            Watch the current season
          </ButtonLink>
          <ButtonLink href="/leaderboard" variant="secondary" size="sm">
            Standings
          </ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
