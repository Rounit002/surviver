import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/");
import Link from "next/link";
import { QuickEntry } from "@/components/entry/QuickEntry";
import { ProductCard } from "@/components/product/ProductCard";
import { Icon } from "@/components/ui/Icon";
import { Countdown } from "@/components/ui/Countdown";
import { getCurrentSeason, getOpenSeason, getSeasonSummary, getActiveRound } from "@/lib/competition/season";
import { getStandings, balanceForVisitor } from "@/lib/competition/standings";
import { getVisitorContext } from "@/lib/tracking/visitor";
import { prisma } from "@/lib/db";
import { formatCount, formatMoney, formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [season, open, visitor, winners] = await Promise.all([
    getCurrentSeason(), getOpenSeason(), getVisitorContext(),
    prisma.seasonEntry.count({ where: { status: "SURVIVOR", season: { status: "COMPLETED" }, product: { approvalStatus: "APPROVED" } } }),
  ]);
  const summary = open ? await getSeasonSummary(open) : null;
  const round = season ? await getActiveRound(season.id) : null;
  const standings = season ? await getStandings(season, round) : null;
  const rows = season ? balanceForVisitor(standings?.rows ?? [], `${visitor.visitorId}:${round?.id ?? ""}`, season) : [];
  const activity = await prisma.activityEvent.findMany({ where: { round: { seasonId: season?.id ?? "none" } }, orderBy: { createdAt: "desc" }, take: 4 });
  const available = summary?.acceptingEntries ?? false;
  return <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-6 sm:pt-10">
    <section className="text-center">
      <div className="border-border inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-subtle">
        <span className={`size-1.5 rounded-full ${round ? "bg-safe" : "bg-primary"}`} />
        {round ? `${season?.name} · ${round.name}` : open ? `${open.name} · Registration open` : "The next season is on its way"}
      </div>
      <h1 className="mt-5 text-[clamp(1.875rem,8vw,2.5rem)] leading-[1.15] font-semibold tracking-tight sm:text-[52px]">Good products deserve<br className="sm:hidden" /> <span className="text-primary">a fighting chance.</span></h1>
      <p className="text-subtle mx-auto mt-4 max-w-xl text-sm leading-7 sm:text-base">A tournament for the next great SaaS products.<br />One flat fee. Real interest. One survivor.</p>
      <QuickEntry available={available} />
      <div className="text-subtle mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
        {summary ? <><span><strong className="text-foreground">{formatMoney(open!.entryPriceCents, open!.currency)}</strong> per entry</span><span><strong className="text-foreground">{summary.remaining}/{open!.capacity}</strong> spots available</span></> : <span>Entry details appear when registration opens.</span>}
        <Link href="/how-it-works" className="underline decoration-border-strong underline-offset-4 hover:text-primary">How it works ↗</Link>
      </div>
    </section>

    <section className="mt-10 sm:mt-14" aria-labelledby="board-title">
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3"><Icon name="grid" className="text-primary" /><h2 id="board-title" className="text-lg font-semibold">The discovery board</h2><span className="bg-muted text-subtle rounded-full px-2.5 py-1 text-xs">{rows.length} products</span></div>
        <Link href="/leaderboard" className="text-subtle flex items-center gap-2 text-xs hover:text-primary"><Icon name="trophy" width="15" />Leaderboard<Icon name="arrow" width="14" /></Link>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          {rows.length ? <div className="space-y-3">{rows.map(row => <ProductCard key={row.entryId} row={row} roundName={round?.name} />)}</div> :
          <div className="border-border flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed bg-surface/60 px-6 py-12 text-center">
            <span className="bg-primary-soft text-primary flex size-14 items-center justify-center rounded-2xl"><Icon name="spark" width="28" height="28" /></span>
            <h3 className="mt-5 text-xl font-semibold">The board is yours to begin.</h3>
            <p className="text-subtle mt-3 max-w-sm text-sm leading-6">Approved entries appear here when the season starts.</p>
            {available && <Link href="/enter" className="text-primary mt-6 inline-flex items-center gap-2 text-sm font-semibold">Be part of the first lineup<Icon name="arrow" width="16" /></Link>}
          </div>}
          <p className="text-subtle mt-4 text-xs leading-5">Paid placements. Order balances exposure; rank is earned, never bought.</p>
        </div>
        <aside className="space-y-5">
          <div className="bg-primary-soft rounded-3xl p-6">
            <div className="text-primary flex items-center gap-2 text-xs font-semibold"><Icon name="spark" width="16" />{open?.name ?? season?.name ?? "Next season"}</div>
            <h3 className="mt-4 text-2xl font-semibold">{open ? `${open.capacity} enter.` : "Made to be discovered."}<br />{open && "One survives."}</h3>
            <p className="text-subtle mt-3 text-xs leading-6">One price for everyone. The strongest interest rates advance.</p>
            {round && <div className="mt-4"><p className="label mb-2">Round ends in</p><Countdown endsAt={round.endAt.toISOString()} serverNow={new Date().toISOString()} size="sm" /></div>}
            {summary && <><div className="mt-5 flex justify-between text-xs"><span>{summary.claimed} entered</span><span>{summary.remaining} spots left</span></div><progress className="mt-2 h-1.5 w-full accent-primary" value={summary.claimed} max={open!.capacity} aria-label="Claimed season spots" /></>}
            <Link href="/rules" className="text-primary mt-5 inline-flex items-center gap-2 text-xs font-semibold">Read the competition rules<Icon name="arrow" width="14" /></Link>
          </div>
          <div className="border-border rounded-3xl border p-5"><h3 className="text-sm font-semibold">Latest activity</h3>{activity.length ? <ul className="mt-3 space-y-4">{activity.map(event => <li key={event.id} className="text-subtle text-xs leading-5">{event.message}<time className="mt-1 block text-[11px]" dateTime={event.createdAt.toISOString()}>{formatRelative(event.createdAt)}</time></li>)}</ul> : <p className="text-subtle mt-3 text-xs leading-6">Season milestones show up here as they happen.</p>}</div>
        </aside>
      </div>
    </section>

    <section id="how-it-works" className="border-border mt-12 border-t pt-9">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">A little competition. A lot of discovery.</h2><Link href="/how-it-works" className="text-primary shrink-0 text-xs">The details ↗</Link></div>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">{[
        ["01", "Put your product in", "Submit your link, pay the flat fee. Every listing is reviewed."],
        ["02", "Let curiosity do its thing", "Visitors explore the board. Views and visits measure real interest."],
        ["03", "Keep earning your place", "Timed rounds narrow the field. The last one standing joins the Hall of Survivors."],
      ].map(([n, title, text]) => <div key={n}><span className="mono text-primary text-xs">{n} /</span><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="text-subtle mt-2 text-xs leading-6">{text}</p></div>)}</div>
      <div className="bg-muted mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4"><span className="text-subtle flex items-center gap-2 text-xs"><Icon name="trophy" width="16" />{formatCount(winners)} {winners === 1 ? "survivor" : "survivors"} crowned</span><Link href="/survivors" className="text-primary text-xs font-medium">Hall of Survivors →</Link></div>
    </section>
  </div>;
}
