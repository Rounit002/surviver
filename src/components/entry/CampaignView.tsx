import { ButtonLink } from "@/components/ui/Button";
import { Chip, StatusChip } from "@/components/ui/Chip";
import { Countdown } from "@/components/ui/Countdown";
import { PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Stat } from "@/components/ui/Stat";
import { CATEGORY_LABELS, ENTRY_STATUS_LABELS } from "@/lib/competition/constants";
import { displayHost, formatCount, formatInterestRate } from "@/lib/format";
import type { CompetitiveStatus, EntryStatus, ProductCategory } from "@/generated/prisma";

/**
 * The campaign panels shown to a founder, whether they arrived through a
 * signed-in dashboard or a secret manage link. Kept free of auth imports so
 * both routes can render it.
 */

export type CampaignRoundStat = {
  id: string;
  rank: number | null;
  status: CompetitiveStatus;
  interestRate: number;
  qualifiedImpressions: number;
  verifiedVisits: number;
  rallyPoints: number;
  round: { name: string; endAt: Date; status: string };
};

export type CampaignEntry = {
  id: string;
  status: EntryStatus;
  rallyCode: string;
  product: { name: string; url: string; category: ProductCategory };
  season: { name: string; minSampleImpressions: number };
  roundStats: CampaignRoundStat[];
};

export function CampaignHeader({ entry }: { entry: CampaignEntry }) {
  const current = entry.roundStats[0];

  return (
    <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold">{entry.product.name}</h2>
          <Chip>{entry.season.name}</Chip>
          <Chip>{CATEGORY_LABELS[entry.product.category]}</Chip>
        </div>
        <p className="text-faint mono mt-1.5 text-[12px]">{displayHost(entry.product.url)}</p>
      </div>

      {current ? (
        <StatusChip status={current.status} />
      ) : (
        <Chip>{ENTRY_STATUS_LABELS[entry.status]}</Chip>
      )}
    </div>
  );
}

export function LiveCampaign({
  entry,
  appUrl,
  serverNow,
}: {
  entry: CampaignEntry;
  appUrl: string;
  serverNow: string;
}) {
  const current = entry.roundStats[0]!;
  const round = current.round;
  const collecting = current.qualifiedImpressions < entry.season.minSampleImpressions;

  return (
    <>
      <div className="divide-border grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0 [&>*]:px-5 [&>*]:py-4">
        <Stat label="Rank" value={current.rank ? `#${current.rank}` : "—"} />
        <Stat
          label="Interest rate"
          value={collecting ? "—" : formatInterestRate(current.interestRate)}
          hint={collecting ? "Collecting data" : undefined}
        />
        <Stat label="Qualified views" value={formatCount(current.qualifiedImpressions)} />
        <Stat label="Verified visits" value={formatCount(current.verifiedVisits)} />
      </div>

      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4">
        <div className="flex items-baseline gap-2">
          <span className="label">{round.name} ends in</span>
          {round.status === "ACTIVE" ? (
            <Countdown endsAt={round.endAt.toISOString()} serverNow={serverNow} size="sm" />
          ) : (
            <span className="text-subtle text-sm">closed</span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="label">Rally points</span>
          <span className="num text-sm font-semibold">{formatCount(current.rallyPoints)}</span>
        </div>
      </div>

      <div className="border-border border-t px-5 py-4">
        <div className="label">Your Rally link</div>
        <p className="text-subtle mt-1.5 text-[13px] leading-relaxed">
          Visitors you bring who explore the board earn you Rally points — a capped exposure
          boost next round.
        </p>
        <code className="border-border bg-muted text-subtle mono mt-3 block truncate rounded-md border px-3 py-2 text-[12px]">
          {appUrl}/rally/{entry.rallyCode}
        </code>
      </div>
    </>
  );
}

/**
 * The end of the road for this product. Deliberately no re-entry call to
 * action: an eliminated founder gets their numbers, not an upsell.
 */
export function EliminatedReport({ entry }: { entry: CampaignEntry }) {
  const last = entry.roundStats[0];
  const totals = entry.roundStats.reduce(
    (acc, s) => ({
      impressions: acc.impressions + s.qualifiedImpressions,
      visits: acc.visits + s.verifiedVisits,
      rally: acc.rally + s.rallyPoints,
    }),
    { impressions: 0, visits: 0, rally: 0 },
  );
  const rate = totals.impressions > 0 ? totals.visits / totals.impressions : 0;

  return (
    <>
      <div className="border-border bg-danger/4 border-b px-5 py-4">
        <p className="text-danger text-sm font-medium">
          Eliminated in {last?.round.name ?? "this season"}
          {last?.rank ? ` — finished #${last.rank}` : ""}
        </p>
        <p className="text-subtle mt-1 text-[13px] leading-relaxed">
          Here is everything your campaign earned.
        </p>
      </div>

      <div className="divide-border grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0 [&>*]:px-5 [&>*]:py-4">
        <Stat label="Qualified views" value={formatCount(totals.impressions)} />
        <Stat label="Verified visits" value={formatCount(totals.visits)} />
        <Stat label="Interest rate" value={formatInterestRate(rate)} />
        <Stat label="Rally points" value={formatCount(totals.rally)} />
      </div>

      {entry.roundStats.length > 1 ? (
        <div className="border-border border-t">
          <PanelHeader title="Round by round" />
          <ul className="divide-border divide-y">
            {[...entry.roundStats].reverse().map((stat) => (
              <li key={stat.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[13px]">
                <span className="font-medium">{stat.round.name}</span>
                <span className="text-subtle flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="num">{formatCount(stat.qualifiedImpressions)} views</span>
                  <span className="num">{formatCount(stat.verifiedVisits)} visits</span>
                  <span className="num">{formatInterestRate(stat.interestRate)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

export function PendingState({ status, showFinish, testMode = false }: { status: EntryStatus; showFinish?: boolean; testMode?: boolean }) {
  const copy: Partial<Record<EntryStatus, string>> = {
    AWAITING_PAYMENT: "Saved but not paid for, so the slot is not held yet.",
    AWAITING_APPROVAL: testMode
      ? "Test checkout completed. No money was charged."
      : "Paid. Finalising your entry.",
    UPCOMING: "Confirmed. Your product is public while the field fills; competition starts at 32.",
    REJECTED: "This entry did not pass review. The payment status holds the refund record.",
    DISQUALIFIED: "This entry was disqualified. See the rules for details.",
  };

  return (
    <PanelBody className="py-8 text-center">
      <p className="text-subtle text-sm">{copy[status] ?? ENTRY_STATUS_LABELS[status]}</p>
      {showFinish && status === "AWAITING_PAYMENT" ? (
        <div className="mt-4">
          <ButtonLink href="/enter" variant="primary" size="sm">
            Enter. Earn your spot.
          </ButtonLink>
        </div>
      ) : null}
    </PanelBody>
  );
}
