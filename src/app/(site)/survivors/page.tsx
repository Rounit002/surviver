import { pageMetadata } from "@/lib/seo";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { prisma } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/competition/constants";
import { displayHost, formatCount, formatDate, formatInterestRate } from "@/lib/format";

export const metadata = pageMetadata("/survivors");

export const dynamic = "force-dynamic";

export default async function SurvivorsPage() {
  const survivors = await prisma.seasonEntry.findMany({
    where: { status: "SURVIVOR" },
    orderBy: { season: { number: "desc" } },
    include: {
      season: true,
      product: true,
      roundStats: { orderBy: { round: { roundNumber: "desc" } }, take: 1 },
    },
  });

  return (
    <div className="shell pt-8 pb-4">
      <header className="text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">Hall of Survivors</h1>
        <p className="text-subtle mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-pretty">
          One product outlasts each season, and stays here for good with the numbers that got it
          through.
        </p>
      </header>

      {survivors.length === 0 ? (
        <Panel className="mt-8">
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="text-border-strong text-4xl" aria-hidden>
              &#9760;
            </div>
            <h2 className="mt-4 text-lg font-semibold">No survivors yet</h2>
            <p className="text-subtle mx-auto mt-2 max-w-sm text-[13px] leading-relaxed">
              When the current season ends, its last product standing is recorded here.
            </p>
            <div className="mt-6 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
              <ButtonLink href="/leaderboard" variant="primary" size="sm">
                Watch the standings
              </ButtonLink>
              <ButtonLink href="/board" variant="secondary" size="sm">
                Browse the board
              </ButtonLink>
            </div>
          </div>
        </Panel>
      ) : (
        <div className="mt-8 space-y-3">
          {survivors.map((entry) => {
            const finalStats = entry.roundStats[0];
            return (
              <Panel key={entry.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="label text-gold">
                      Survivor &mdash; {entry.season.name}
                    </div>
                    <h2 className="mt-1.5 text-lg font-semibold">{entry.product.name}</h2>
                    <p className="text-subtle mt-1 text-[13px]">{entry.product.tagline}</p>
                    <div className="text-faint mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
                      <span>{CATEGORY_LABELS[entry.product.category]}</span>
                      <span aria-hidden>&middot;</span>
                      <span className="mono">{displayHost(entry.product.url)}</span>
                      {entry.season.seasonEnd ? (
                        <>
                          <span aria-hidden>&middot;</span>
                          <span>Won {formatDate(entry.season.seasonEnd)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {finalStats ? (
                    <div className="flex gap-6">
                      <div>
                        <div className="label">Interest rate</div>
                        <div className="num mt-1 text-xl font-semibold">
                          {formatInterestRate(finalStats.interestRate)}
                        </div>
                      </div>
                      <div>
                        <div className="label">Visits</div>
                        <div className="num mt-1 text-xl font-semibold">
                          {formatCount(finalStats.verifiedVisits)}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
