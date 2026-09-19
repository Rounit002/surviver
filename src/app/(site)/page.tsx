import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/");
import Link from "next/link";
import { CategoryBar } from "@/components/layout/CategoryBar";
import { QuickEntry } from "@/components/entry/QuickEntry";
import { PresenceCounter } from "@/components/layout/PresenceCounter";
import { ProductCard } from "@/components/product/ProductCard";
import { UpcomingProductList } from "@/components/product/UpcomingProductList";
import { Badge, BadgeDot } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getCurrentSeason, getOpenSeason, getSeasonSummary, getActiveRound } from "@/lib/competition/season";
import { getStandings, balanceForVisitor } from "@/lib/competition/standings";
import { readPresence } from "@/lib/tracking/presence";
import { getVisitorContext } from "@/lib/tracking/visitor";
import { prisma } from "@/lib/db";
import { formatCount, formatMoney, formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The landing page.
 *
 * Deliberately not a marketing page with a product screenshot in it: the board
 * is the product, so the showcase under the hero is the live board rather than
 * a picture of one. Every number on this page is read from the database — if a
 * season has not started, the sections that depend on one say so rather than
 * showing a placeholder.
 */
export default async function HomePage() {
  const [season, open, visitor, presence, winners] = await Promise.all([
    getCurrentSeason(),
    getOpenSeason(),
    getVisitorContext(),
    readPresence(),
    prisma.seasonEntry.count({
      where: {
        status: "SURVIVOR",
        season: { status: "COMPLETED" },
        product: { approvalStatus: "APPROVED" },
      },
    }),
  ]);
  const summary = open ? await getSeasonSummary(open) : null;
  const round = season ? await getActiveRound(season.id) : null;
  const standings = season ? await getStandings(season, round) : null;
  const rows = season
    ? balanceForVisitor(standings?.rows ?? [], `${visitor.visitorId}:${round?.id ?? ""}`, season)
    : [];
  const activity = await prisma.activityEvent.findMany({
    where: { round: { seasonId: season?.id ?? "none" } },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
  const available = summary?.acceptingEntries ?? false;
  // A full season is the point of the format, not a failure to sell: the hero
  // says the field is complete rather than showing "0 spots available".
  const full = summary?.isFull ?? false;

  return (
    <>
      {/* ---------------------------------------------------------------- *
          Hero. The badge states the one fact that changes — which season,
          and whether it can still be entered — so the headline never has to.
       * ---------------------------------------------------------------- */}
      <section className="section-hero pb-8">
        <div className="shell">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <Reveal>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge tone={round || available ? "accent" : "neutral"}>
                  {round ? (
                    <>
                      <BadgeDot />
                      {season?.name} &middot; {round.name}
                    </>
                  ) : open ? (
                    <>
                      <BadgeDot />
                      {open.name} &middot; {full ? "All spots filled" : "Registration open"}
                    </>
                  ) : (
                    "The next season is on its way"
                  )}
                </Badge>
                <PresenceCounter initial={presence} />
              </div>
            </Reveal>

            <Reveal delay={90}>
              <h1 className="text-display mt-6 font-bold tracking-tight">
                Good products deserve
                <br />
                <span className="text-primary">a fighting chance.</span>
              </h1>
            </Reveal>

            <Reveal delay={150}>
              <p className="text-subtle text-lead measure mt-5">
                A promotional tournament for SaaS products. One flat fee, equal exposure for
                everyone, and real measured interest decides who survives.
              </p>
            </Reveal>

            <Reveal delay={210} className="mt-9 w-full">
              <QuickEntry
                available={available}
                full={full}
                priceLabel={open ? formatMoney(open.entryPriceCents, open.currency) : undefined}
              />
            </Reveal>

            {/* The commercial facts, on one line, immediately under the action */}
            <Reveal delay={280}>
              <div className="text-subtle mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px]">
                {summary ? (
                  <>
                    <span>
                      <strong className="text-foreground font-medium">
                        {formatMoney(open!.entryPriceCents, open!.currency)}
                      </strong>{" "}
                      flat entry fee
                    </span>
                    <span className="bg-border hidden h-3 w-px sm:block" aria-hidden />
                    <span>
                      {full ? (
                        <>
                          <strong className="text-foreground font-medium">All {open!.capacity}</strong>{" "}
                          spots filled
                        </>
                      ) : (
                        <>
                          <strong className="text-foreground font-medium num">
                            {summary.remaining}/{open!.capacity}
                          </strong>{" "}
                          spots available
                        </>
                      )}
                    </span>
                  </>
                ) : (
                  <span>Entry details appear when registration opens.</span>
                )}
                <span className="bg-border hidden h-3 w-px sm:block" aria-hidden />
                <Link
                  href="/how-it-works"
                  className="hover:text-foreground text-primary inline-flex items-center gap-1 font-medium transition-colors"
                >
                  How scoring works
                  <Icon name="arrow" width="13" height="13" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
          outbid.lol Stats Strip: 3 centered tabular metric cards
       * ---------------------------------------------------------------- */}
      <section className="shell mb-10">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {/* Card 1: Visitors & Live presence */}
          <div className="border-border bg-surface flex flex-col justify-between rounded-[16px] border p-4.5 sm:p-5 shadow-xs transition-all duration-150 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <span className="label text-faint text-[11px]">Live Presence</span>
              <span className="pulse-dot bg-live inline-block size-2 rounded-full" aria-hidden />
            </div>
            <div className="mt-3">
              <div className="num text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                {formatCount(presence.online)}
                <span className="text-subtle ml-2 text-xs font-normal">online now</span>
              </div>
              <p className="text-faint mt-1 text-xs">
                <span className="num font-semibold text-foreground">{formatCount(presence.total)}</span> verified visits
              </p>
            </div>
          </div>

          {/* Card 2: Tournament Slots */}
          <div className="border-border bg-surface flex flex-col justify-between rounded-[16px] border p-4.5 sm:p-5 shadow-xs transition-all duration-150 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <span className="label text-faint text-[11px]">Tournament Field</span>
              <span className="text-primary font-mono text-xs font-semibold">
                {open ? formatMoney(open.entryPriceCents, open.currency) : "Flat Fee"}
              </span>
            </div>
            <div className="mt-3">
              <div className="num text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                {summary ? `${summary.claimed} / ${open?.capacity}` : "35"}
                <span className="text-subtle ml-2 text-xs font-normal">
                  {full ? "field full" : "spots entered"}
                </span>
              </div>
              {open && summary ? (
                <div className="bg-muted mt-2.5 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (summary.claimed / open.capacity) * 100)}%` }}
                  />
                </div>
              ) : (
                <p className="text-faint mt-1 text-xs">35 contestants enter, 1 survives</p>
              )}
            </div>
          </div>

          {/* Card 3: Active Round / Timer */}
          <div className="border-border bg-surface flex flex-col justify-between rounded-[16px] border p-4.5 sm:p-5 shadow-xs transition-all duration-150 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <span className="label text-faint text-[11px]">{round ? "Active Phase" : "Tournament State"}</span>
              <span className="text-subtle font-mono text-xs">
                {round ? round.name : open?.name ?? "Season One"}
              </span>
            </div>
            <div className="mt-3">
              {round ? (
                <div>
                  <div className="text-xs text-subtle mb-1">Round elimination in</div>
                  <Countdown endsAt={round.endAt.toISOString()} serverNow={new Date().toISOString()} size="sm" />
                </div>
              ) : (
                <div>
                  <div className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">Registration</div>
                  <p className="text-faint mt-1 text-xs">Earned rankings &middot; Timed rounds</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
          The showcase. The product is the board, so the board is what is on
          display — framed, not pasted on.
       * ---------------------------------------------------------------- */}
      <section id="board" className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="Live board"
            title="Thirty-five products. Equal exposure."
            copy="Order is shuffled for every visitor, so nobody compounds their own lead. Rank is earned from measured interest and cannot be bought."
            action={
              <ButtonLink href="/leaderboard" variant="secondary" size="sm">
                <Icon name="trophy" width="14" height="14" />
                Leaderboard
              </ButtonLink>
            }
          />

          <Reveal delay={60} className="mt-10">
            <CategoryBar />
          </Reveal>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Reveal delay={100} as="div">
              {rows.length ? (
                <div className="space-y-3">
                  {rows.map((row) => (
                    <ProductCard
                      key={row.entryId}
                      row={row}
                      roundName={round?.name}
                      visitor={visitor}
                    />
                  ))}
                </div>
              ) : (
                <div className="border-border bg-surface flex min-h-80 flex-col items-center justify-center rounded-[20px] border border-dashed px-6 py-16 text-center">
                  <span className="bg-primary-soft text-primary flex size-12 items-center justify-center rounded-[14px]">
                    <Icon name="spark" width="22" height="22" />
                  </span>
                  <h3 className="text-heading mt-6 font-semibold">The field is filling.</h3>
                  <p className="text-subtle mt-3 max-w-sm text-sm leading-relaxed">
                    Paid and approved entries are listed below while the field fills. Competition starts at 35.
                  </p>
                  {available ? (
                    <ButtonLink href="/enter" variant="primary" size="md" className="mt-7">
                      Be part of the first lineup
                      <Icon name="arrow" width="15" height="15" />
                    </ButtonLink>
                  ) : null}
                </div>
              )}
              <p className="text-subtle mt-5 text-xs leading-relaxed">
                Paid placements. Order balances exposure; rank is earned, never bought.
              </p>
            </Reveal>

            <Reveal delay={160} as="aside" className="space-y-4">
              <div className="border-border bg-surface rounded-[20px] border p-6">
                <p className="label label-bright">{open?.name ?? season?.name ?? "Next season"}</p>
                <h3 className="text-heading mt-4 font-semibold">
                  {open ? `${open.capacity} enter.` : "Made to be discovered."}
                  {open ? (
                    <>
                      <br />
                      One survives.
                    </>
                  ) : null}
                </h3>
                <p className="text-subtle mt-3 text-sm leading-relaxed">
                  One price for everyone. The strongest interest rates advance.
                </p>

                {round ? (
                  <div className="border-border mt-5 border-t pt-5">
                    <p className="label mb-2.5">Round ends in</p>
                    <Countdown
                      endsAt={round.endAt.toISOString()}
                      serverNow={new Date().toISOString()}
                      size="sm"
                    />
                  </div>
                ) : null}

                {summary ? (
                  <div className="border-border mt-5 border-t pt-5">
                    <div className="text-subtle flex justify-between text-xs">
                      <span>
                        <span className="num">{summary.claimed}</span> entered
                      </span>
                      <span>
                        {full ? (
                          "Field complete"
                        ) : (
                          <>
                            <span className="num">{summary.remaining}</span> spots left
                          </>
                        )}
                      </span>
                    </div>
                    <div className="bg-muted mt-2.5 h-1 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (summary.claimed / open!.capacity) * 100)}%`,
                        }}
                        role="progressbar"
                        aria-valuenow={summary.claimed}
                        aria-valuemin={0}
                        aria-valuemax={open!.capacity}
                        aria-label="Claimed season spots"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-border rounded-[20px] border p-6">
                <h3 className="label label-bright">Latest activity</h3>
                {activity.length ? (
                  <ul className="mt-4 space-y-4">
                    {activity.map((event) => (
                      <li key={event.id} className="text-subtle text-[13px] leading-relaxed">
                        {event.message}
                        <time
                          className="text-faint mt-1 block text-[11px]"
                          dateTime={event.createdAt.toISOString()}
                        >
                          {formatRelative(event.createdAt)}
                        </time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-subtle mt-3 text-[13px] leading-relaxed">
                    Season milestones show up here as they happen.
                  </p>
                )}
              </div>
            </Reveal>
          </div>

          {open || (!round && season?.status === "REGISTRATION_CLOSED") ? (
            <UpcomingProductList seasonId={(open ?? season)!.id} capacity={(open ?? season)!.capacity} />
          ) : null}
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
          Process. Numbered rows rather than three cards — the steps are
          sequential, and a card grid says "unordered set".
       * ---------------------------------------------------------------- */}
      <section id="how-it-works" className="border-border bg-elevated section border-y">
        <div className="shell">
          <SectionHeading
            eyebrow="The format"
            title="A little competition. A lot of discovery."
            action={
              <Link
                href="/how-it-works"
                className="text-primary inline-flex items-center gap-1.5 text-sm font-medium"
              >
                The details
                <Icon name="arrow" width="14" height="14" />
              </Link>
            }
          />

          <div className="mt-14 grid gap-px">
            {[
              [
                "01",
                "Put your product in",
                "Submit your link and pay the flat fee. Your product is listed once payment is confirmed.",
              ],
              [
                "02",
                "Let curiosity do its thing",
                "Visitors explore the board. Qualified views and verified visits measure genuine interest, not budget.",
              ],
              [
                "03",
                "Keep earning your place",
                "Timed rounds narrow the field. The last product standing joins the Hall of Survivors.",
              ],
            ].map(([n, title, text], i) => (
              <Reveal
                key={n}
                delay={i * 80}
                className="border-border grid gap-4 border-t py-8 first:border-t-0 first:pt-0 md:grid-cols-[6rem_minmax(0,20rem)_minmax(0,1fr)] md:items-baseline md:gap-10"
              >
                <span className="mono text-subtle text-[13px]">{n}</span>
                <h3 className="text-[17px] font-semibold">{title}</h3>
                <p className="text-subtle text-sm leading-relaxed">{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
          Close. One action, and the single number that makes the case for
          taking it.
       * ---------------------------------------------------------------- */}
      <section className="section-lg">
        <div className="shell">
          <Reveal className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="label">
              {winners > 0
                ? `${formatCount(winners)} ${winners === 1 ? "survivor" : "survivors"} crowned`
                : "Season one is open"}
            </p>
            <h2 className="text-title mt-5 font-semibold">
              Your product deserves to be found.
            </h2>
            <p className="text-subtle text-lead measure mt-5">
              Equal exposure, a flat fee, and a ranking nobody can buy their way into.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/enter" variant="primary" size="lg">
                Enter your product
                <Icon name="arrow" width="16" height="16" />
              </ButtonLink>
              <ButtonLink href="/survivors" variant="secondary" size="lg">
                Hall of Survivors
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
