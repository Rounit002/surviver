import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Chip, LiveBadge } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { CLAIMED_ENTRY_STATUSES, publicSeasonFilter } from "@/lib/competition/season";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { EnterButton } from "@/components/entry/EnterButton";

export const metadata = pageMetadata("/seasons");

export const dynamic = "force-dynamic";

export default async function SeasonsPage() {
  const seasons = await prisma.season.findMany({
    where: publicSeasonFilter,
    orderBy: { number: "desc" },
    include: {
      entries: {
        where: { status: "SURVIVOR" },
        take: 1,
        select: { product: { select: { name: true, slug: true } } },
      },
    },
  });

  // One grouped query rather than a count per season.
  const claimedBySeason = new Map<string, number>(
    (
      await prisma.seasonEntry.groupBy({
        by: ["seasonId"],
        where: { status: { in: CLAIMED_ENTRY_STATUSES } },
        _count: { _all: true },
      })
    ).map((group) => [group.seasonId, group._count._all]),
  );

  return (
    <div className="shell section">
      <header>
        <h1 className="text-title font-semibold">Seasons</h1>
        <p className="text-subtle mt-2">Every season stays public, results and all.</p>
      </header>

      {seasons.length === 0 ? (
        <Panel className="mt-8 px-6 py-16 text-center">
          <p className="text-subtle text-sm">No seasons yet.</p>
        </Panel>
      ) : (
        <div className="mt-8 space-y-3">
          {seasons.map((season) => {
            const claimed = claimedBySeason.get(season.id) ?? 0;
            const winner = season.entries[0]?.product;

            return (
              <Panel key={season.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-semibold">{season.name}</h2>
                      <SeasonStatusChip status={season.status} />
                    </div>

                    <div className="text-subtle mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
                      <span>
                        <span className="num">{claimed}</span> / {season.capacity} entered
                      </span>
                      <span aria-hidden>&middot;</span>
                      <span>{formatMoney(season.entryPriceCents, season.currency)} entry</span>
                      {season.seasonStart ? (
                        <>
                          <span aria-hidden>&middot;</span>
                          <span>Started {formatDate(season.seasonStart)}</span>
                        </>
                      ) : null}
                      {season.seasonEnd ? (
                        <>
                          <span aria-hidden>&middot;</span>
                          <span>Ended {formatDate(season.seasonEnd)}</span>
                        </>
                      ) : null}
                    </div>

                    {winner ? (
                      <p className="mt-3 text-[13px]">
                        <span className="label">Survivor</span>{" "}
                        <span className="text-gold font-semibold">{winner.name}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {season.status === "RUNNING" ? (
                      <ButtonLink href="/leaderboard" variant="primary" size="sm">
                        Watch live
                      </ButtonLink>
                    ) : season.status === "REGISTRATION_OPEN" ? (
                      <EnterButton className={buttonClass("primary", "sm")}>
                        Enter
                      </EnterButton>
                    ) : null}
                    <ButtonLink href={`/seasons/${season.number}`} variant="secondary" size="sm">
                      Details
                    </ButtonLink>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link href="/survivors" className="text-primary hover:underline">
          Past winners →
        </Link>
      </p>
    </div>
  );
}

function SeasonStatusChip({ status }: { status: string }) {
  if (status === "RUNNING") return <LiveBadge label="Live" />;
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    REGISTRATION_OPEN: "Taking entries",
    REGISTRATION_CLOSED: "Registration closed",
    COMPLETED: "Complete",
    CANCELLED: "Cancelled",
  };
  return <Chip>{labels[status] ?? status}</Chip>;
}
