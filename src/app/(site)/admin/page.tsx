import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Stat } from "@/components/ui/Stat";
import { requireAdmin } from "@/lib/auth/guards";
import { CATEGORY_LABELS } from "@/lib/competition/constants";
import { CLAIMED_ENTRY_STATUSES } from "@/lib/competition/season";
import { prisma } from "@/lib/db";
import { displayHost, formatCount, formatMoney, formatRelative } from "@/lib/format";
import { approveEntryAction, rejectEntryAction, startSeasonAction, advanceSeasonAction } from "./actions";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

  const [pending, seasons, revenue, paidCount, recentActions] = await Promise.all([
    prisma.seasonEntry.findMany({
      where: { status: "AWAITING_APPROVAL" },
      orderBy: { createdAt: "asc" },
      include: {
        season: { select: { name: true } },
        product: { include: { owner: { select: { name: true, email: true, xHandle: true } } } },
        payment: { select: { amountCents: true, currency: true, status: true } },
      },
    }),
    prisma.season.findMany({ orderBy: { number: "desc" }, take: 5 }),
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { amountCents: true, refundedCents: true },
    }),
    prisma.payment.count({ where: { status: "SUCCEEDED" } }),
    prisma.adminAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { admin: { select: { name: true } } },
    }),
  ]);

  const gross = revenue._sum.amountCents ?? 0;
  const refunded = revenue._sum.refundedCents ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-4">
      <header>
        <div className="label">Administration</div>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Season control</h1>
      </header>

      <Panel className="mt-6">
        <div className="divide-border grid grid-cols-2 divide-y sm:grid-cols-4 sm:divide-x sm:divide-y-0 [&>*]:px-4 [&>*]:py-3.5">
          <Stat label="Awaiting review" value={formatCount(pending.length)} />
          <Stat label="Paid entries" value={formatCount(paidCount)} />
          <Stat label="Gross revenue" value={formatMoney(gross)} />
          <Stat
            label="Refunded"
            value={formatMoney(refunded)}
            tone={refunded > 0 ? "text-danger" : undefined}
          />
        </div>
      </Panel>

      <Panel className="mt-6">
        <PanelHeader
          title={`Entries awaiting review (${pending.length})`}
          action={
            pending.length > 0 ? (
              <span className="label text-rising">Review before the season starts</span>
            ) : null
          }
        />

        {pending.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-subtle text-sm">Nothing waiting. Every paid entry is reviewed.</p>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {pending.map((entry) => (
              <li key={entry.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold">{entry.product.name}</h3>
                      <Chip>{CATEGORY_LABELS[entry.product.category]}</Chip>
                      <Chip>{entry.season.name}</Chip>
                    </div>

                    <p className="text-subtle mt-1.5 text-[13px]">{entry.product.tagline}</p>
                    <p className="text-subtle mt-2 text-[13px] leading-relaxed">
                      {entry.product.description}
                    </p>

                    <div className="text-faint mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
                      <a
                        href={entry.product.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-primary hover:text-primary/80 mono"
                      >
                        {displayHost(entry.product.url)} &nearr;
                      </a>
                      <span aria-hidden>&middot;</span>
                      <span>{entry.product.owner.name}</span>
                      <span aria-hidden>&middot;</span>
                      <span className="mono">{entry.product.owner.email}</span>
                      {entry.product.owner.xHandle ? (
                        <>
                          <span aria-hidden>&middot;</span>
                          <span className="mono">@{entry.product.owner.xHandle}</span>
                        </>
                      ) : null}
                      <span aria-hidden>&middot;</span>
                      <span>
                        {entry.payment
                          ? `${formatMoney(entry.payment.amountCents, entry.payment.currency)} ${entry.payment.status.toLowerCase()}`
                          : "no payment"}
                      </span>
                      <span aria-hidden>&middot;</span>
                      <span>submitted {formatRelative(entry.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:w-56">
                    <form action={approveEntryAction}>
                      <input type="hidden" name="entryId" value={entry.id} />
                      <Button type="submit" variant="primary" size="sm" className="w-full">
                        Approve
                      </Button>
                    </form>

                    <form action={rejectEntryAction} className="space-y-2">
                      <input type="hidden" name="entryId" value={entry.id} />
                      <input
                        name="reason"
                        placeholder="Reason for rejection"
                        maxLength={500}
                        className="border-border bg-surface placeholder:text-faint hover:border-border-strong focus:border-primary h-8 w-full rounded-md border px-2.5 text-[13px] focus:outline-none"
                      />
                      <Button type="submit" variant="danger" size="sm" className="w-full">
                        Reject · refund owed
                      </Button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Seasons" />
          <ul className="divide-border divide-y">
            {seasons.map((season) => (
              <li key={season.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{season.name}</div>
                  <div className="text-faint mt-0.5 text-[12px]">
                    capacity {season.capacity} &middot;{" "}
                    {formatMoney(season.entryPriceCents, season.currency)} &middot; cut at{" "}
                    {formatCount(season.minSampleImpressions)} views
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2"><Chip>{season.status.replaceAll("_", " ").toLowerCase()}</Chip>
                {["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "RUNNING"].includes(season.status) && <form action={season.status === "RUNNING" ? advanceSeasonAction : startSeasonAction}><input type="hidden" name="seasonId" value={season.id} /><Button size="sm" variant="secondary" type="submit">{season.status === "RUNNING" ? "Process due round" : "Start approved lineup"}</Button></form>}</div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Audit log" />
          {recentActions.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-faint text-[13px]">No manual actions recorded.</p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {recentActions.map((action) => (
                <li key={action.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="mono text-[13px]">{action.actionType}</span>
                    <span className="text-faint text-[12px]">
                      {formatRelative(action.createdAt)}
                    </span>
                  </div>
                  <div className="text-faint mt-0.5 text-[12px]">
                    by {action.admin.name} &middot;{" "}
                    <span className="mono">{action.targetId.slice(0, 12)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-faint mt-6 text-[12px]">
        Claimed slots count paid entries only: {CLAIMED_ENTRY_STATUSES.length} entry states
        occupy capacity, and unpaid drafts never do.
      </p>
    </div>
  );
}
