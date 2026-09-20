import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CampaignHeader,
  EliminatedReport,
  LiveCampaign,
  PendingState,
} from "@/components/entry/CampaignView";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isDevPayments } from "@/lib/payments";
import { hashCapability } from "@/lib/security/tokens";

export const dynamic = "force-dynamic";

// A secret link. Keep it out of search results and referrer headers.
export const metadata: Metadata = {
  title: "Your campaign",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Campaign management by capability link (PRD-adjacent: entering requires no
 * account, so this URL is the founder's only credential). It is long and
 * random, never listed, and never indexed.
 */
export default async function EntryPage(props: PageProps<"/entry/[token]">) {
  const { token } = await props.params;

  if (token.length < 20 || token.length > 128) notFound();

  const now = new Date();
  const tokenHash = hashCapability(token);
  const entry = await prisma.seasonEntry.findFirst({
    where: { AND: [
      { manageToken: tokenHash },
      { manageTokenRevokedAt: null },
      { OR: [{ manageTokenExpiresAt: null }, { manageTokenExpiresAt: { gt: now } }] },
    ] },
    include: {
      payment: { select: { status: true } },
      product: { select: { name: true, url: true, category: true } },
      season: { select: { name: true, minSampleImpressions: true } },
      roundStats: {
        orderBy: { round: { roundNumber: "desc" } },
        include: { round: { select: { name: true, endAt: true, status: true } } },
      },
    },
  });

  if (!entry) notFound();

  // Derived from what was actually settled, never from a query parameter a
  // visitor can add to the URL.
  // There is no review stage: a settled payment puts the entry straight onto
  // the field, so the receipt shows until the season actually starts running it.
  const paid = entry.payment?.status === "SUCCEEDED" && entry.status === "UPCOMING";
  const serverNow = new Date().toISOString();
  const hasStats = entry.roundStats.length > 0;
  const testMode = isDevPayments();

  return (
    <div className="shell max-w-2xl pt-8 pb-4">
      {paid ? (
        <div className="border-safe/25 bg-safe/8 text-safe mb-6 rounded-lg border px-4 py-3 text-[13px] leading-relaxed">
          <strong className="font-semibold">{testMode ? "Test checkout completed." : "Payment succeeded."}</strong>{" "}
          Your entry is confirmed and publicly listed. Competition starts when the field is full.
        </div>
      ) : null}

      <header className="text-center">
        <div className="label">Your campaign</div>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{entry.product.name}</h1>
      </header>

      <Panel className="mt-6">
        <CampaignHeader entry={entry} />

        {entry.status === "ELIMINATED" ? (
          <EliminatedReport entry={entry} />
        ) : hasStats ? (
          <LiveCampaign entry={entry} appUrl={env.appUrl} serverNow={serverNow} />
        ) : (
          <PendingState status={entry.status} testMode={testMode} />
        )}
      </Panel>

      <Panel inset elevated={false} className="mt-5 px-5 py-4">
        <div className="label">Keep this link</div>
        <p className="text-subtle mt-1.5 text-[13px] leading-relaxed">
          No account, no password: anyone with this link can see these numbers. Bookmark it and
          keep it to yourself.
        </p>
      </Panel>

      <div className="mt-8 flex justify-center gap-2">
        <ButtonLink href="/board" variant="secondary" size="sm">
          See the board
        </ButtonLink>
        <ButtonLink href="/leaderboard" variant="secondary" size="sm">
          Standings
        </ButtonLink>
      </div>
    </div>
  );
}
