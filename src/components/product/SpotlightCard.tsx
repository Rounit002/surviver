"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A card with the "flashlight" hover used on Stripe's and Cursor's sites: a
 * soft light follows the pointer across the card and brightens the border
 * nearest to it.
 *
 * The pointer position is written straight to two CSS variables — no React
 * state — so moving across a grid of cards costs no re-renders. On touch
 * screens there is no hover, and the card is simply a card.
 */
export function SpotlightCard({
  href,
  glow,
  className,
  children,
  label,
}: {
  href: string;
  /** The light's colour; the product's category ink. */
  glow: string;
  className?: string;
  children: ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      aria-label={label}
      className={cn("spotlight-card group", className)}
      style={{ "--glow": glow } as CSSProperties}
      onPointerMove={(event) => {
        const el = event.currentTarget;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--x", `${event.clientX - rect.left}px`);
        el.style.setProperty("--y", `${event.clientY - rect.top}px`);
      }}
    >
      {children}
    </a>
  );
}
