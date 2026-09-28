import type { CSSProperties } from "react";
import { BrandIcon, SOCIAL_LINKS } from "@/components/ui/BrandIcon";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * The exposure every spot gets beyond the board: shown on the YouTube live
 * stream and shouted out in Discord.
 *
 * Said with the two logos and a few words rather than a paragraph — people
 * recognise the marks faster than they read a sentence about them.
 */

const STRIP = [
  { brand: "youtube", href: SOCIAL_LINKS.youtube, label: "YouTube Live", hint: "On stream", color: "#ff0000" },
  { brand: "discord", href: SOCIAL_LINKS.discord, label: "Discord", hint: "Shout-out", color: "#5865f2" },
] as const;

/** The hero's "also featured on" row: two large, tappable brand tiles. */
export function ExtraReachStrip({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2.5 lg:items-start", className)}>
      <p className="text-subtle text-[13px] font-semibold uppercase tracking-[0.08em]">Every spot is also featured on</p>
      <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
        {STRIP.map((item) => (
          <a
            key={item.brand}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="reach-tile group"
            style={{ "--brand": item.color } as CSSProperties}
          >
            <span className="reach-tile-icon">
              <BrandIcon brand={item.brand} size={24} />
            </span>
            <span className="flex flex-col text-left leading-tight">
              <span className="text-foreground text-[15px] font-bold">{item.label}</span>
              <span className="text-subtle text-xs">{item.hint}</span>
            </span>
            <Icon name="arrow" width={14} className="text-subtle ml-1 transition-transform duration-150 group-hover:translate-x-0.5" />
          </a>
        ))}
      </div>
    </div>
  );
}

const CARDS = [
  {
    brand: "youtube",
    href: SOCIAL_LINKS.youtube,
    title: "Shown on the live stream",
    text: "Every listed product is shown on YouTube Live.",
    cta: "Watch @rounieee",
    tint: "color-mix(in oklab, #ff0000 7%, var(--color-surface))",
    ring: "color-mix(in oklab, #ff0000 22%, transparent)",
  },
  {
    brand: "discord",
    href: SOCIAL_LINKS.discord,
    title: "A shout-out in Discord",
    text: "Every listed product gets a shout-out to the community.",
    cta: "Join the Discord",
    tint: "color-mix(in oklab, #5865f2 9%, var(--color-surface))",
    ring: "color-mix(in oklab, #5865f2 28%, transparent)",
  },
] as const;

/** Two cards: where the extra reach happens, and a link to each. */
export function ExtraReachCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {CARDS.map((card) => (
        <a
          key={card.brand}
          href={card.href}
          target="_blank"
          rel="noopener noreferrer"
          className="card-lift group flex items-start gap-4 rounded-[20px] border p-5 sm:p-6"
          style={{ backgroundColor: card.tint, borderColor: card.ring }}
        >
          <span className="bg-surface flex size-12 shrink-0 items-center justify-center rounded-[14px] shadow-sm">
            <BrandIcon brand={card.brand} size={26} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold">{card.title}</span>
            <span className="text-subtle mt-1 block text-sm">{card.text}</span>
            <span className="text-foreground mt-3 inline-flex items-center gap-1 text-sm font-semibold">
              {card.cta}
              <Icon name="arrow" width={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}
