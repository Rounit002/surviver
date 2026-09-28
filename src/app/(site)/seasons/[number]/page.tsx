import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoundBar } from "@/components/competition/RoundBar";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/Chip";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Stat } from "@/components/ui/Stat";
import { CATEGORY_LABELS } from "@/lib/competition/constants";
import { getActiveRound, parseSeasonNumber, publicSeasonFilter } from "@/lib/competition/season";
import { getStandings } from "@/lib/competition/standings";
import { prisma } from "@/lib/db";
import { displayHost, formatCount, formatDate, formatInterestRate, formatMoney } from "@/lib/format";
import { EnterButton } from "@/components/entry/EnterButton";

export const dynamic = "force-dynamic";

/**
 * The lookup happens here as well as in the page. Metadata is generated before
 * the document starts streaming, so calling notFound() at this point produces a
 * real 404 status; doing it only in the page would leave an already-flushed 200
 * on a page that renders as missing.
 */
export async function generateMetadata(
  props: PageProps<"/seasons/[number]">,
): Promise<Metadata> {
  const { number } = await props.params;
  const parsed = parseSeasonNumber(number);
  if (parsed === null) notFound();

  const season = await prisma.season.findFirst({
    where: { number: parsed, ...publicSeasonFilter },
    select: { name: true },
  });
  if (!season) notFound();

  return pageMetadata(`/seasons/${parsed}`, season.name, `Full standings and results for ${season.name} on Surviver.lol.`);
}

export default async function SeasonPage(props: PageProps<"/seasons/[number]">) {
  const { number } = await props.params;
  const parsed = parseSeasonNumber(number);
  if (parsed === null) notFound();

  const season = await prisma.season.findFirst({ where: { number: parsed, ...publicSeasonFilter } });
  if (!season) notFound();

  // A finished season shows its final round; a live one shows the active round.
  const round =
    (await getActiveRound(season.id)) ??
    (await prisma.round.findFirst({
      where: { seasonId: season.id },
      orderBy: { roundNumber: "desc" },
    }));

  const standings = await getStandings(season, round);

  const totals = standings.rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.qualifiedImpressions,
      visits: acc.visits + r.verifiedVisits,
    }),
    { impressions: 0, visits: 0 },
  );

  const serverNow = new Date().toISOString();
  const isLive = season.status === "RUNNING";

  return (
    <div className="shell section">
      <header>
        <div className="eyebrow">
          {season.status === "COMPLETED"
            ? "Season archive"
            : isLive
              ? "Live season"
              : "Season"}
        </div>
        <h1 className="text-title mt-3 font-semibold">{season.name}</h1>
        <div className="text-subtle mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
          <span>{formatMoney(season.entryPriceCents, season.currency)} entry</span>
          <span aria-hidden>&middot;</span>
          <span>
            <span className="num">{season.capacity}</span> spots
          </span>
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
      </header>

      {standings.rows.length === 0 ? (
        <Panel className="mt-8 px-6 py-16 text-center">
          <p className="text-subtle text-sm">
            No standings yet — this season has not started.
          </p>
          {season.status === "REGISTRATION_OPEN" ? (
            <div className="mt-5">
              <EnterButton className={buttonClass("primary", "sm")}>
                Enter {season.name}
              </EnterButton>
            </div>
          ) : null}
        </Panel>
      ) : (
        <>
          {round ? (
            <div className="mt-7">
              <RoundBar
                season={season}
                round={round}
                competing={standings.rows.length}
                serverNow={serverNow}
              />
            </div>
          ) : null}

          <Panel className="mt-6">
            <div className="divide-border grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0 [&>*]:px-5 [&>*]:py-4">
              <Stat label="Contestants" value={formatCount(standings.rows.length)} />
              <Stat label="Clicks" value={formatCount(totals.visits)} />
              <Stat label="Views" value={formatCount(totals.impressions)} />
              <Stat
                label="Click rate"
                value={formatInterestRate(
                  totals.impressions > 0 ? totals.visits / totals.impressions : 0,
                )}
              />
            </div>
          </Panel>

          <Panel className="mt-6 overflow-hidden">
            <PanelHeader
              title={
                season.status === "COMPLETED"
                  ? "Final standings"
                  : "Live standings"
              }
            />
            <ol className="divide-border divide-y">
              {standings.rows.map((row) => {
                return (
                  <li
                    key={row.entryId}
                    className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                  >
                    <span className="num text-foreground text-sm font-semibold">
                      {row.rank ?? "—"}
                    </span>

                    <div className="min-w-0">
                      <a
                        href={`/go/${row.product.slug}`}
                        target="_blank"
                        rel="noopener noreferrer nofollow sponsored"
                        className="hover:text-primary truncate text-sm font-medium transition-colors"
                      >
                        {row.product.name}
                      </a>
                      <div className="text-subtle mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px]">
                        <span>{CATEGORY_LABELS[row.product.category]}</span>
                        <span aria-hidden>&middot;</span>
                        <span className="mono">{displayHost(row.product.url)}</span>
                        <span aria-hidden>&middot;</span>
                        <span className="num">{formatCount(row.qualifiedImpressions)} views</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="num text-sm font-semibold">
                        {formatCount(row.verifiedVisits)}
                        <span className="text-subtle ml-1 text-xs font-normal">clicks</span>
                      </span>
                      <span className="hidden sm:block">
                        <StatusChip status={row.status} />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </>
      )}

      <div className="mt-8">
        <ButtonLink href="/seasons" variant="secondary" size="sm">
          All seasons
        </ButtonLink>
      </div>
    </div>
  );
}
