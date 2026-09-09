"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatCountdownAuto } from "@/lib/format";

/**
 * Display-only clock.
 *
 * The server decides when a round actually ends (PRD 7); this component only
 * renders the remaining time. It corrects for client clock skew by anchoring to
 * the server timestamp captured when the page was rendered, so a machine whose
 * clock is an hour fast does not show an hour less of competition.
 */
export function Countdown({
  endsAt,
  serverNow,
  className,
  size = "md",
  onExpire,
}: {
  endsAt: string;
  serverNow: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  onExpire?: () => void;
}) {
  const [remaining, setRemaining] = useState(() => {
    const skew = Date.now() - new Date(serverNow).getTime();
    return new Date(endsAt).getTime() - (Date.now() - skew);
  });

  useEffect(() => {
    const skew = Date.now() - new Date(serverNow).getTime();
    const deadline = new Date(endsAt).getTime();

    const tick = () => {
      const next = deadline - (Date.now() - skew);
      setRemaining(next);
      if (next <= 0) onExpire?.();
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, serverNow, onExpire]);

  const expired = remaining <= 0;
  const urgent = !expired && remaining < 60 * 60 * 1000;

  const sizes = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-3xl",
    xl: "text-5xl sm:text-6xl",
  } as const;

  return (
    <span
      className={cn(
        "mono font-semibold tracking-tight",
        sizes[size],
        expired ? "text-faint" : urgent ? "text-danger" : "text-foreground",
        className,
      )}
      // Screen readers should not have every tick announced.
      aria-live="off"
      suppressHydrationWarning
    >
      {expired ? "00:00:00" : formatCountdownAuto(remaining)}
    </span>
  );
}
