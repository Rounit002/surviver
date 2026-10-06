"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  siAirtable,
  siAsana,
  siCalendly,
  siClerk,
  siClickup,
  siFigma,
  siFramer,
  siGumroad,
  siHubspot,
  siIntercom,
  siLemonsqueezy,
  siLinear,
  siLoom,
  siMailchimp,
  siMixpanel,
  siNetlify,
  siNotion,
  siObsidian,
  siPlausibleanalytics,
  siPosthog,
  siPostman,
  siRaycast,
  siResend,
  siSentry,
  siShopify,
  siStripe,
  siSupabase,
  siTodoist,
  siTrello,
  siVercel,
  siWebflow,
  siZapier,
  type SimpleIcon,
} from "simple-icons";
import { SiteFavicon } from "@/components/product/SiteFavicon";
import { BrandIcon, SOCIAL_LINKS } from "@/components/ui/BrandIcon";
import type { ProductCategory } from "@/generated/prisma";
import { cn } from "@/lib/cn";

export type ShowcaseEntry = {
  id: string;
  name: string;
  url: string;
  logoUrl: string | null;
  category: ProductCategory;
};

/**
 * Channel numbers shown under the stream window. They are a claim about the
 * real channel, so keep them true. Read from youtube.com/@rounieee/streams on
 * 2026-10-06: 8.03K subscribers; the last 29 streams averaged 13.4K views and
 * all fell within four weeks.
 */
const STREAM_STATS = [
  { label: "Subscribers", value: 8030 },
  { label: "Avg views / stream", value: 13400 },
  { label: "Live streams / month", value: 29 },
] as const;

/**
 * Real SaaS marks (Simple Icons, CC0 artwork) that fill the slots real entries
 * have not taken yet. Ordered so neighbouring tiles differ in colour.
 */
const BRANDS: SimpleIcon[] = [
  siNotion, siFigma, siStripe, siSupabase, siLinear, siZapier, siVercel, siShopify,
  siFramer, siMailchimp, siRaycast, siAirtable, siPosthog, siHubspot, siWebflow, siGumroad,
  siLoom, siTodoist, siClerk, siNetlify, siObsidian, siLemonsqueezy, siTrello, siSentry,
  siCalendly, siAsana, siMixpanel, siResend, siClickup, siIntercom, siPostman, siPlausibleanalytics,
];

/** How many tiles leave the lineup for the stream: five per side rail. */
const FEATURED = 10;
const RAIL = FEATURED / 2;

/** Which rail slot is on screen during one pass of the stream: alternating sides. */
const ON_AIR = [0, 5, 1, 6, 2, 7];

/**
 * The rails flip one card every `FLIP_MS`, in this order, so each slot turns
 * over to the next product every ~4.5s and the whole lineup gets air time.
 */
const FLIP_ORDER = [0, 5, 1, 6, 2, 7, 3, 8, 4, 9];
const FLIP_MS = 450;
const LIVE_FLIPS = 24;

/** Tiles picked for the stream after the real entries: spread over the 8 × 4 grid. */
const SPREAD = [2, 5, 9, 14, 16, 19, 22, 27, 29, 11, 24, 31];

/**
 * - `full`  the lineup as the server renders it, already complete
 * - `fill`  an empty lineup filling slot by slot
 * - `pick`  ten tiles light up: they are going on stream
 * - `fly`   the site window recedes and those tiles fly into the stream rails
 * - `live`  the stream window, cycling through who is on screen
 * - `out`   the stream fades away before the next loop
 */
type Phase = "full" | "fill" | "pick" | "fly" | "live" | "out";

type Item =
  | { key: string; kind: "entry"; name: string; entry: ShowcaseEntry }
  | { key: string; kind: "brand"; name: string; brand: SimpleIcon };

type Flyer = { item: Item; from: Box; to: Box };
/** A two-faced rail card: `turns` half-turns so far, and the item index on each face. */
type Card = { turns: number; front: number; back: number };
type Box = { x: number; y: number; w: number; h: number };

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumSignificantDigits: 3 });

/**
 * The hero's picture, drawn as two Mac windows that tell the offer in one
 * loop: 32 products register on surviver.lol, then the ones on air fly across
 * into the YouTube live stream, framed by the channel's numbers.
 *
 * Real lineup entries take the first slots and the stream features them first;
 * the rest are real SaaS marks.
 */
export function HeroStreamShowcase({ entries, capacity }: { entries: ShowcaseEntry[]; capacity: number }) {
  const items: Item[] = Array.from({ length: capacity }, (_, i) => {
    const entry = entries[i];
    if (entry) return { key: entry.id, kind: "entry", name: entry.name, entry };
    const brand = BRANDS[(i - entries.length) % BRANDS.length];
    return { key: `brand-${i}`, kind: "brand", name: brand.title, brand };
  });
  const real = items.flatMap((item, i) => (item.kind === "entry" ? [i] : [])).slice(0, FEATURED);
  const featured = [...real, ...SPREAD.filter((i) => i < capacity && !real.includes(i))].slice(0, FEATURED);

  const [phase, setPhase] = useState<Phase>("full");
  const [spot, setSpot] = useState(0);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const firstDeck = (): Card[] => featured.map((index) => ({ turns: 0, front: index, back: index }));
  const [deck, setDeck] = useState<Card[]>(firstDeck);

  const scene = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLElement | null)[]>([]);
  const slots = useRef<(HTMLElement | null)[]>([]);
  const flyerEls = useRef<(HTMLElement | null)[]>([]);

  // The loop. It runs only while the showcase is on screen and restarts from an
  // empty lineup when it comes back.
  useEffect(() => {
    const root = scene.current;
    if (!root) return;
    // Reduced motion never starts the loop; CSS shows the finished stream instead.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let run = 0;
    let first = true;
    const timers = new Set<number>();
    const wait = (ms: number, id: number) =>
      new Promise<boolean>((resolve) => {
        const t = window.setTimeout(() => {
          timers.delete(t);
          resolve(id === run);
        }, ms);
        timers.add(t);
      });

    const play = async (id: number) => {
      while (id === run) {
        if (!first) {
          setPhase("fill");
          if (!(await wait(capacity * 45 + 1100, id))) return;
        } else if (!(await wait(900, id))) return;
        first = false;

        setPhase("pick");
        if (!(await wait(700, id))) return;

        setDeck(firstDeck());
        setFlyers(featured.map((tileIndex, slotIndex) => ({ item: items[tileIndex], from: boxOf(tiles.current[tileIndex], root), to: boxOf(slots.current[slotIndex], root) })));
        setPhase("fly");
        if (!(await wait(1300, id))) return;

        setFlyers([]);
        setPhase("live");
        // Everyone not yet on the rails, in lineup order, then round again.
        const queue = [...items.keys()].filter((i) => !featured.includes(i));
        let next = 0;
        let onScreen = 0;
        for (let t = 0; t < LIVE_FLIPS; t++) {
          if (t % 4 === 0) {
            onScreen = ON_AIR[(t / 4) % ON_AIR.length];
            setSpot(onScreen);
          }
          const slot = FLIP_ORDER[t % FLIP_ORDER.length];
          // The card on screen holds still until the stream moves on.
          if (slot !== onScreen && queue.length) {
            const incoming = queue[next++ % queue.length];
            setDeck((cards) => cards.map((card, i) => (i !== slot ? card : card.turns % 2 ? { ...card, front: incoming, turns: card.turns + 1 } : { ...card, back: incoming, turns: card.turns + 1 })));
          }
          if (!(await wait(FLIP_MS, id))) return;
        }

        setPhase("out");
        if (!(await wait(600, id))) return;
        setSpot(0);
      }
    };

    const stop = () => {
      run++;
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
    const observer = new IntersectionObserver(([entry]) => {
      stop();
      if (entry.isIntersecting) void play(run);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      stop();
    };
    // The loop reads `items` and `featured` through closures that only change
    // with the server's data, which remounts the page anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity]);

  // FLIP: each flyer is laid out where it lands and starts from where it left,
  // arcing up and over on the way.
  useLayoutEffect(() => {
    flyers.forEach(({ from, to }, i) => {
      const el = flyerEls.current[i];
      if (!el) return;
      const s0 = from.w / to.w;
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${s0})` },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 46}px) scale(${(s0 + 1) * 0.55})`, offset: 0.5 },
          { transform: "none" },
        ],
        { duration: 900, delay: i * 35, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "both" },
      );
    });
  }, [flyers]);

  const onAir = phase === "fly" || phase === "live" || phase === "out";
  const landed = phase === "live" || phase === "out";
  const shown = (card: Card) => (card.turns % 2 ? card.back : card.front);
  const current = items[shown(deck[spot])];
  const host = current.kind === "entry" ? hostOf(current.entry.url) : null;

  return (
    <div className="hs-root" data-phase={phase}>
      <p className="sr-only">
        Products register for one of {capacity} spots on surviver.lol, and every one is featured on the YouTube live stream.
      </p>

      <div className="hs-stage">
        {/* Pencilled margin notes, as in the sketch: each one wakes with its window. */}
        <div className="hs-note hs-note-left hand" data-on={!onAir || undefined} aria-hidden>
          <span>
            32 spots.
            <br />
            One is yours.
          </span>
          <NoteArrow />
        </div>
        <div className="hs-note hs-note-right hand" data-on={landed || undefined} aria-hidden>
          <span>
            Every product
            <br />
            goes live.
          </span>
          <NoteArrow />
        </div>

        <div ref={scene} className="hs-scene" aria-hidden>
          {/* Window one: the site, nothing but its 32 spots filling up. */}
          <div className="hs-window hs-site">
            <WindowBar>
              <span className="hs-url">
                <LockGlyph />
                surviver.lol
              </span>
            </WindowBar>
            <div className="hs-site-body">
              <ul className="hs-grid">
                {items.map((item, i) => (
                  <li
                    key={item.key}
                    ref={(el) => {
                      tiles.current[i] = el;
                    }}
                    className={cn("hs-tile", featured.includes(i) && "hs-featured")}
                    style={{ "--i": i } as CSSProperties}
                  >
                    <Mark item={item} />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Window two: a YouTube live player, with the lineup on its side rails. */}
          <div className="hs-window hs-stream">
            <WindowBar>
              <span className="hs-url">
                <BrandIcon brand="youtube" size={11} />
                youtube.com/@rounieee/live
              </span>
            </WindowBar>
            <div className="hs-stream-body">
              <div className="hs-player">
                <div className="hs-player-head">
                  <span className="hs-avatar">
                    <BrandIcon brand="youtube" size={12} mono />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-semibold">Surviver.lol Live — the season lineup</span>
                    <span className="block opacity-70">@rounieee</span>
                  </span>
                </div>

                <div className="hs-video">
                  <Rail from={0} deck={deck} items={items} slots={slots} spot={spot} live={phase === "live"} />

                  {/* What the stream is showing: the product's own page, on screen. */}
                  <div key={landed ? `${spot}-${shown(deck[spot])}` : "standby"} className="hs-share">
                    <div className="hs-share-bar">
                      <span className="hs-share-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="hs-share-url">{host ?? `${current.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`}</span>
                    </div>
                    <div className="hs-share-body">
                      <Mark item={current} className="hs-share-mark" />
                      <span className="hs-share-name">{current.name}</span>
                      <span className="hs-share-tag">Featured on stream</span>
                    </div>
                  </div>

                  <Rail from={RAIL} deck={deck} items={items} slots={slots} spot={spot} live={phase === "live"} />
                </div>

                <div className="hs-controls">
                  <span className="hs-scrub">
                    <span />
                  </span>
                  <span className="hs-controls-row">
                    <PlayerGlyph d="M8 5v14l11-7z" fill />
                    <PlayerGlyph d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" fill />
                    <span className="hs-live-tag">
                      <span className="pulse-dot size-1.5 rounded-full bg-[#ff0033]" />
                      LIVE
                    </span>
                    <LiveClock running={phase === "live"} />
                    <PlayerGlyph d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4zM13 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" fill />
                    <PlayerGlyph d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* The tiles in flight between the two windows. */}
          <div className="hs-flight">
            {flyers.map((flyer, i) => (
              <span
                key={flyer.item.key}
                ref={(el) => {
                  flyerEls.current[i] = el;
                }}
                className="hs-flyer"
                style={{ left: flyer.to.x, top: flyer.to.y, width: flyer.to.w, height: flyer.to.h }}
              >
                <Mark item={flyer.item} />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Under the windows: what the first one shows, then the channel's numbers. */}
      <div className="hs-caption">
        <div className="hs-caption-step" data-on={!onAir || undefined}>
          <span className="mono bg-primary-soft text-primary rounded-[6px] px-1.5 py-0.5 text-[11px] font-bold">01</span>
          <span className="text-sm font-semibold">Products register on surviver.lol</span>
        </div>
        <a href={SOCIAL_LINKS.youtube} target="_blank" rel="noopener noreferrer" className="hs-caption-stats glass-card" data-on={onAir || undefined} tabIndex={onAir ? 0 : -1}>
          <span className="hs-stat-brand">
            <BrandIcon brand="youtube" size={18} />
            <span className="text-[11px] leading-tight font-semibold">
              Featured
              <br />
              on stream
            </span>
          </span>
          {STREAM_STATS.map((stat) => (
            <span key={stat.label} className="hs-stat">
              <CountUp value={stat.value} active={landed} />
              <span className="text-subtle text-[11px] leading-tight">{stat.label}</span>
            </span>
          ))}
        </a>
      </div>
    </div>
  );
}

function Rail({
  from,
  deck,
  items,
  slots,
  spot,
  live,
}: {
  from: number;
  deck: Card[];
  items: Item[];
  slots: React.RefObject<(HTMLElement | null)[]>;
  spot: number;
  live: boolean;
}) {
  return (
    <ul className="hs-rail">
      {Array.from({ length: RAIL }, (_, k) => {
        const slot = from + k;
        return (
          <li
            key={slot}
            ref={(el) => {
              slots.current[slot] = el;
            }}
            className="hs-slot"
            data-on={(live && spot === slot) || undefined}
          >
            <span className="hs-card" style={{ transform: `rotateY(${deck[slot].turns * 180}deg)` }}>
              <span className="hs-face">
                <Mark item={items[deck[slot].front]} />
              </span>
              <span className="hs-face hs-face-back">
                <Mark item={items[deck[slot].back]} />
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** A product's real mark: its favicon for an entry, its brand glyph otherwise. */
function Mark({ item, className }: { item: Item; className?: string }) {
  if (item.kind === "entry") {
    return (
      <span className={cn("hs-mark", className)}>
        <SiteFavicon name={item.entry.name} siteUrl={item.entry.url} logoUrl={item.entry.logoUrl} className="size-[56%] rounded-[22%] border-0 bg-transparent" />
      </span>
    );
  }
  const { hex, path } = item.brand;
  // Near-black marks follow the ink so they stay visible in dark mode.
  const fill = luminance(hex) < 0.06 ? "currentColor" : `#${hex}`;
  return (
    <span className={cn("hs-mark", className)}>
      <svg viewBox="0 0 24 24" width="52%" height="52%" fill={fill} aria-hidden>
        <path d={path} />
      </svg>
    </span>
  );
}

function WindowBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="hs-bar">
      <span className="hs-lights">
        <i />
        <i />
        <i />
      </span>
      {children}
    </div>
  );
}

/** The stream's elapsed time, ticking while it is on air. */
function LiveClock({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(5047);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const hh = Math.floor(seconds / 3600);
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return <span className="num ml-auto opacity-80">{`${hh}:${mm}:${ss}`}</span>;
}

/** Counts up from zero each time the stream comes on air. */
function CountUp({ value, active }: { value: number; active: boolean }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, value]);
  return <span className="num text-base leading-none font-bold sm:text-lg">{compact.format(Math.round(shown))}</span>;
}

/** An element's box relative to the scene, from layout offsets so transforms mid-animation do not skew it. */
function boxOf(el: HTMLElement | null, root: HTMLElement): Box {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el?.offsetWidth ?? 0, h: el?.offsetHeight ?? 0 };
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function luminance(hex: string) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function LockGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function PlayerGlyph({ d, fill = false }: { d: string; fill?: boolean }) {
  return (
    <svg className="hs-glyph" viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function NoteArrow() {
  return (
    <svg className="hs-note-arrow" viewBox="0 0 110 56" aria-hidden>
      <path d="M8 6c18 2 42 6 62 18s26 18 32 26" pathLength={1} />
      <path d="M90 45l12 5 1-13" pathLength={1} />
    </svg>
  );
}
