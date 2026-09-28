import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/");
import Link from "next/link";
import { CategoryBar } from "@/components/layout/CategoryBar";
import { QuickEntry } from "@/components/entry/QuickEntry";
import { PresenceCounter } from "@/components/layout/PresenceCounter";
import { LineupField } from "@/components/competition/LineupField";
import { ProductCard } from "@/components/product/ProductCard";
import { HeroRanking } from "@/components/home/HeroRanking";
import { HeroGlow } from "@/components/home/HeroGlow";
import { ExtraReachCards, ExtraReachStrip } from "@/components/home/ExtraReach";
import { UpcomingProductList } from "@/components/product/UpcomingProductList";
import { buttonClass } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { FIELD_SIZE } from "@/lib/competition/constants";
import { getCurrentSeason, getOpenSeason, getSeasonSummary, getActiveRound, getPublicUpcomingEntries } from "@/lib/competition/season";
import { getStandings, balanceForVisitor } from "@/lib/competition/standings";
import { readPresence } from "@/lib/tracking/presence";
import { getVisitorContext } from "@/lib/tracking/visitor";
import { prisma } from "@/lib/db";
import { createInteractionProof } from "@/lib/security/tokens";
import { formatMoney, formatRelative } from "@/lib/format";
import { EnterButton } from "@/components/entry/EnterButton";

export const dynamic = "force-dynamic";

/**
 * The landing page.
 *
 * Hero, then the thing everyone is watching: during registration that is the
 * 32-slot lineup filling up; once the season is live it is the top three by
 * clicks. Then the board itself, the format in three cards, and one closing
 * call to action. Every number is read from the database.
 */
export default async function HomePage() {
  const [season, open, visitor, presence] = await Promise.all([
    getCurrentSeason(),
    getOpenSeason(),
    getVisitorContext(),
    readPresence(),
  ]);
  const summary = open ? await getSeasonSummary(open) : null;
  const round = season ? await getActiveRound(season.id) : null;
  const standings = season ? await getStandings(season, round) : null;
  const rows = season
    ? balanceForVisitor(standings?.rows ?? [], `${visitor.visitorId}:${round?.id ?? ""}`, season)
    : [];
  const lineupSeason = open ?? (season && season.status !== "RUNNING" && season.status !== "COMPLETED" ? season : null);
  const lineup = lineupSeason ? await getPublicUpcomingEntries(lineupSeason.id) : [];
  const activity = await prisma.activityEvent.findMany({
    where: { round: { seasonId: season?.id ?? "none" } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const available = summary?.acceptingEntries ?? false;
  const full = summary?.isFull ?? false;
  const capacity = (open ?? season)?.capacity ?? FIELD_SIZE;
  const price = open ? formatMoney(open.entryPriceCents, open.currency) : null;
  const serverNow = new Date().toISOString();
  const podium = (standings?.rows ?? []).slice(0, 4);

  return (
    <>
      {/* ---------------------------------------------------------------- *
          Hero
       * ---------------------------------------------------------------- */}
      <section className="hero-atmosphere section-hero pb-12">
        <HeroGlow />
        <div className="shell">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
            {/* Left: the offer, said once and plainly. */}
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <Reveal>
                <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <span className="bg-primary-soft text-primary inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold">
                    <span className={round ? "pulse-dot bg-live size-2 rounded-full" : "bg-live size-2 rounded-full"} />
                    {round
                      ? `${season?.name} is live`
                      : open
                        ? full
                          ? "Field full · starting soon"
                          : `${summary?.remaining ?? capacity} of ${capacity} spots open`
                        : "Next season opening soon"}
                  </span>
                  <PresenceCounter initial={presence} />
                </div>
              </Reveal>

              <Reveal delay={90}>
                <h1 className="hero-title mt-6 font-extrabold">
                  {capacity} SaaS spots.
                  <br />
                  <span className="hero-underline text-primary">
                    Ranked by clicks.
                    <svg viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden>
                      <path d="M4 11C60 4 120 3 170 6s90 5 126-1" pathLength="1" />
                    </svg>
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={150}>
                <p className="text-subtle mt-5 max-w-md text-lg leading-relaxed">
                  Every product stays live all season. Real visitors decide the rank.
                </p>
              </Reveal>

              <Reveal delay={210} className="mt-8 w-full max-w-xl">
                <QuickEntry available={available} full={full} priceLabel={price ?? undefined} />
              </Reveal>

              <Reveal delay={260}>
                <ul className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
                  {[price ? `${price} flat` : "One flat fee", "Live all season", "No bidding"].map((label) => (
                    <li key={label} className="border-border bg-surface inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[13px] font-semibold">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-primary" aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                      {label}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={310}>
                <ExtraReachStrip className="mt-6" />
                {round ? (
                  <p className="text-subtle mt-4 text-[13px]">
                    Ends in{" "}
                    <Countdown endsAt={round.endAt.toISOString()} serverNow={serverNow} size="sm" className="text-[13px]" />
                  </p>
                ) : null}
              </Reveal>
            </div>

            {/* Right: what the board looks like. */}
            <Reveal delay={200} className="mx-auto w-full max-w-md lg:max-w-none">
              <HeroRanking rows={podium} live={Boolean(round)} />
            </Reveal>
          </div>

          {lineupSeason && !round ? (
            <Reveal delay={340} className="mt-16">
              <LineupField
                seasonName={lineupSeason.name}
                capacity={capacity}
                held={summary?.held ?? 0}
                open={available}
                entries={lineup.map(({ id, product }) => ({ id, href: `/go/${product.slug}?proof=${encodeURIComponent(createInteractionProof(id, visitor))}`, slug: product.slug, name: product.name, url: product.url, logoUrl: product.logoUrl, category: product.category }))}
              />
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
          The board
       * ---------------------------------------------------------------- */}
      <section id="board" className="section pt-8">
        <div className="shell">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">
                <span className={round ? "pulse-dot bg-live size-1.5 rounded-full" : "bg-primary size-1.5 rounded-full"} />
                {round ? "Live now" : "The board"}
              </p>
              <h2 className="text-title mt-3 font-semibold">
                {round ? "Click what you like." : "Who’s in so far."}
              </h2>
            </div>
            <Link
              href="/leaderboard"
              className="text-subtle hover:text-foreground hidden items-center gap-1.5 text-sm font-medium transition-colors sm:inline-flex"
            >
              Leaderboard
              <Icon name="arrow" width="14" height="14" />
            </Link>
          </div>

          <div className="mt-6">
            <CategoryBar />
          </div>

          <div className={activity.length ? "mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]" : "mt-5"}>
            <div>
              {rows.length ? (
                <div className="space-y-2.5">
                  {rows.map((row) => (
                    <ProductCard key={row.entryId} row={row} visitor={visitor} />
                  ))}
                </div>
              ) : lineup.length === 0 ? (
                <div className="border-border bg-surface/60 flex flex-col items-center rounded-[20px] border border-dashed px-6 py-14 text-center">
                  <span className="bg-accent-soft text-accent flex size-12 items-center justify-center rounded-[14px]">
                    <Icon name="spark" width="22" height="22" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">Be the first in the lineup</h3>
                  <p className="text-subtle mt-1.5 text-sm">Ranking starts when all {capacity} spots are filled.</p>
                  {available ? (
                    <EnterButton className={buttonClass("primary", "md", "mt-6")}>
                      Claim a spot
                      <Icon name="arrow" width="15" height="15" />
                    </EnterButton>
                  ) : null}
                </div>
              ) : null}

              {!rows.length && lineupSeason ? (
                <UpcomingProductList seasonId={lineupSeason.id} capacity={capacity} />
              ) : null}

              <p className="text-subtle mt-4 text-xs">Paid placements. Rank is earned, never bought.</p>
            </div>

            {activity.length ? (
              <aside className="border-border bg-surface h-fit rounded-[20px] border p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="pulse-dot bg-live size-1.5 rounded-full" />
                  Activity
                </h3>
                <ul className="mt-4 space-y-3.5">
                  {activity.map((event) => (
                    <li key={event.id} className="text-[13px] leading-snug">
                      {event.message}
                      <time className="text-subtle mt-0.5 block text-[11px]" dateTime={event.createdAt.toISOString()}>
                        {formatRelative(event.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
          The format
       * ---------------------------------------------------------------- */}
      <section id="how-it-works" className="section border-border bg-elevated border-y">
        <div className="shell">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 className="text-title mt-3 font-semibold">Simple on purpose.</h2>
            </div>
            <Link
              href="/how-it-works"
              className="text-subtle hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              Details
              <Icon name="arrow" width="14" height="14" />
            </Link>
          </div>

          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { title: "Claim a spot", text: `Drop your link and pay once${price ? ` — ${price}` : ""}. You’re in the lineup instantly.`, icon: "spark", tone: "var(--cat-dev-tools-tint)", ink: "var(--cat-dev-tools-ink)" },
              { title: `Starts at ${capacity}`, text: `Nothing is ranked until all ${capacity} spots fill. Then everyone goes live together.`, icon: "grid", tone: "var(--cat-founder-tools-tint)", ink: "var(--cat-founder-tools-ink)" },
              { title: "Clicks set the rank", text: "Everyone stays live all season. Real visits move you up. Nobody is cut.", icon: "bars", tone: "var(--cat-productivity-tint)", ink: "var(--cat-productivity-ink)" },
            ].map((step, i) => (
              <Reveal key={step.title} as="li" delay={i * 80} className="card-lift border-border bg-surface rounded-[20px] border p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-[12px]" style={{ backgroundColor: step.tone, color: step.ink }}>
                    <Icon name={step.icon as "spark" | "grid" | "bars"} width="20" height="20" />
                  </span>
                  <span className="mono text-subtle text-xs font-semibold">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="text-subtle mt-1.5 text-sm leading-relaxed">{step.text}</p>
              </Reveal>
            ))}
          </ol>

          <div className="mt-12">
            <h3 className="text-lg font-semibold">Every spot also gets</h3>
            <div className="mt-4">
              <ExtraReachCards />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
          Close
       * ---------------------------------------------------------------- */}
      <section className="section">
        <div className="shell">
          <Reveal className="band rounded-[28px] px-6 py-14 text-center sm:px-12 sm:py-16">
            <h2 className="text-title mx-auto max-w-2xl font-semibold">Your product deserves to be found.</h2>
            <p className="mx-auto mt-3 max-w-md opacity-85">
              {summary && !full ? `${summary.remaining} of ${capacity} spots still open.` : `${capacity} spots. One flat fee. Live all season.`}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <EnterButton
                className="inline-flex min-h-12 items-center gap-2 rounded-[12px] bg-white px-5.5 text-[15px] font-semibold text-[#1f1d1b] shadow-lg transition-transform duration-150 hover:-translate-y-px"
              >
                Enter. Earn your spot.
                <Icon name="arrow" width="16" height="16" />
              </EnterButton>
              <Link
                href="/survivors"
                className="inline-flex min-h-12 items-center rounded-[12px] border border-white/35 bg-white/10 px-5.5 text-[15px] font-medium text-white transition-colors duration-150 hover:bg-white/20"
              >
                Hall of Survivors
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
