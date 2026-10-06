"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { SiteFavicon } from "./SiteFavicon";
import { useLogoColor } from "./useLogoColor";

/**
 * Pastels for a card whose logo has no readable colour: warm and fresh hues,
 * deliberately no violet. Mixed into the surface the same way a logo colour is.
 */
const FALLBACK = ["#f59e0b", "#10b981", "#0ea5e9", "#f43f5e", "#14b8a6", "#f97316"];

export type LineupCardData = {
  href: string;
  name: string;
  host: string;
  url: string;
  logoUrl: string | null;
  tagline: string;
  category: string;
  clicks: number;
  joined: string;
  spot: number;
};

/**
 * A lineup product as a card on a little stack: its pastel — taken from the
 * product's own logo — fills the card, a second sheet sits behind it, and the
 * tagline is the headline, set large with a marker stroke under it.
 *
 * On hover the card tilts toward the pointer and the sheet behind fans out.
 * The tilt is written to CSS variables, so moving across the grid costs no
 * re-renders; reduced motion and touch screens get a still card.
 */
export function LineupCard({ data }: { data: LineupCardData }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const brand = useLogoColor(data.url) ?? FALLBACK[(data.spot - 1) % FALLBACK.length];

  const tilt = (event: React.PointerEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el || event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    el.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
  };
  const settle = () => {
    ref.current?.style.setProperty("--ry", "0deg");
    ref.current?.style.setProperty("--rx", "0deg");
  };

  return (
    <a
      ref={ref}
      href={data.href}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      aria-label={`Visit ${data.name}`}
      className="lineup-card group"
      style={{ "--brand": brand } as CSSProperties}
      onPointerMove={tilt}
      onPointerLeave={settle}
    >
      <span className="lineup-card-face">
        <span className="flex items-center gap-3">
          <SiteFavicon name={data.name} siteUrl={data.url} logoUrl={data.logoUrl} className="lineup-card-logo size-11 rounded-[13px] border-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{data.name}</span>
            <span className="text-subtle mono block truncate text-[11px]">{data.host}</span>
          </span>
          <span className="lineup-card-spot mono">#{String(data.spot).padStart(2, "0")}</span>
        </span>

        <span className="lineup-card-tagline">
          <span>{data.tagline}</span>
        </span>

        <span className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="flex items-center gap-2 text-xs">
            <span className="lineup-card-chip">{data.category}</span>
            <span className="text-subtle">
              <span className="num text-foreground font-semibold">{data.clicks}</span> {data.clicks === 1 ? "click" : "clicks"} · {data.joined}
            </span>
          </span>
          <span className="lineup-card-go" aria-hidden>
            <Icon name="arrow" width={15} strokeWidth={2.5} />
          </span>
        </span>
      </span>
    </a>
  );
}
