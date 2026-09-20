import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  CampaignHeader,
  EliminatedReport,
  LiveCampaign,
  PendingState,
} from "@/components/entry/CampaignView";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { signOutAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CAMPAIGN_TOKEN_COOKIE } from "@/lib/competition/constants";
import { hashCapability } from "@/lib/security/tokens";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Founder dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const user = await getSessionUser();
  const token = (await cookies()).get(CAMPAIGN_TOKEN_COOKIE)?.value;
  const guestAccess = token && /^[A-Za-z0-9_-]{43}$/.test(token)
    ? { manageToken: hashCapability(token), manageTokenRevokedAt: null, manageTokenExpiresAt: { gt: new Date() } }
    : null;
  if (!user && !guestAccess) redirect("/login?next=%2Fdashboard");
  const params = await props.searchParams;
  const justEntered = params.entered === "1";

  const entries = await prisma.seasonEntry.findMany({
    where: { OR: [...(user ? [{ product: { ownerId: user.id } }] : []), ...(guestAccess ? [guestAccess] : [])] },
    orderBy: { createdAt: "desc" },
    include: {
      product: true,
      season: true,
      payment: { select: { status: true } },
      roundStats: {
        orderBy: { round: { roundNumber: "desc" } },
        include: { round: true },
      },
    },
  });

  const serverNow = new Date().toISOString();

  return (
    <div className="shell pt-8 pb-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="label">Founder dashboard</div>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{user?.name ?? "Your product"}</h1>
          <p className="text-faint mono mt-1 text-[13px]">{user?.email ?? "Private access for this browser. Save your campaign link for later."}</p>
        </div>

        {user ? <form action={signOutAction}>
          <SubmitButton variant="ghost" size="sm" pendingLabel="Signing out…">
            Sign out
          </SubmitButton>
        </form> : null}
      </header>

      {justEntered ? (
        <div className="border-safe/25 bg-safe/8 text-safe mt-6 rounded-lg border px-4 py-3 text-[13px]">
          Your entry status is shown below. Payment is confirmed by the payment provider.
        </div>
      ) : null}

      {entries.length === 0 ? (
        <Panel className="mt-6">
          <PanelBody className="py-14 text-center">
            <p className="text-subtle text-sm">You have not entered a season yet.</p>
            <p className="text-faint mx-auto mt-2 max-w-sm text-[13px] leading-relaxed">
              Paste your product link and pay the flat fee. Confirmed payments are listed automatically.
            </p>
            <div className="mt-5">
              <ButtonLink href="/enter" variant="primary" size="sm">
                Enter. Earn your spot.
              </ButtonLink>
            </div>
          </PanelBody>
        </Panel>
      ) : (
        <div className="mt-6 space-y-5">
          {entries.map((entry) => {
            const current = entry.roundStats[0];

            return (
              <Panel key={entry.id}>
                <CampaignHeader entry={entry} />

                {entry.status === "ELIMINATED" ? (
                  <EliminatedReport entry={entry} />
                ) : current ? (
                  <LiveCampaign entry={entry} appUrl={env.appUrl} serverNow={serverNow} />
                ) : (
                  <PendingState status={entry.status} showFinish />
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
