"use client";

import type { CSSProperties } from "react";
import { SiteFavicon } from "@/components/product/SiteFavicon";
import { useLogoColor } from "@/components/product/useLogoColor";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/competition/constants";
import type { LineupEntry } from "./LineupField";

/**
 * One taken spot in the lineup: the product's icon on a plain tile whose
 * border picks up the logo's own colour, faintly — a yellow logo gets a yellow
 * edge, a blue one a blue edge. Until the colour is read (or for a monochrome
 * logo) the edge falls back to the product's category ink.
 */
export function LineupTile({ entry }: { entry: LineupEntry }) {
  const brand = useLogoColor(entry.url);
  const ink = brand ?? CATEGORY_COLORS[entry.category].ink;

  return (
    <a
      href={entry.href}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      title={`${entry.name} · ${CATEGORY_LABELS[entry.category]}`}
      className="lineup-tile group"
      style={{ "--brand": ink } as CSSProperties}
    >
      <SiteFavicon name={entry.name} siteUrl={entry.url} logoUrl={entry.logoUrl} className="size-[62%] rounded-[7px] border-0 bg-transparent" />
      <span className="sr-only">{entry.name}</span>
    </a>
  );
}
