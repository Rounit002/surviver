"use client";

import { useEffect, useState } from "react";
import { formatCount } from "@/lib/format";
import type { Presence } from "@/lib/tracking/presence";

/**
 * How many people are here now, and how many have been — two entries in the
 * home page's stat strip.
 *
 * The server renders the counts it already knows, so the line is in the first
 * HTML response rather than popping in. The heartbeat then adds this visitor
 * and replaces the numbers — which is why a first-ever visitor sees the online
 * count tick up by one a moment after load. That is real: they were not in the
 * table when the page was rendered, because the proxy sets their cookie on the
 * response carrying that very page.
 *
 * The beat only runs while the tab is actually being looked at. A backgrounded
 * tab that kept checking in would report as present for as long as it stayed
 * open, which would make "online now" mean "has the site open somewhere",
 * a much weaker and much larger number.
 */
export function PresenceCounter({ initial }: { initial: Presence }) {
  const [presence, setPresence] = useState(initial);

  useEffect(() => {
    let cancelled = false;

    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/presence", {
          method: "POST",
          headers: { "content-type": "application/json" },
        });
        if (!response.ok) return;
        const next: Presence = await response.json();
        // A heartbeat that fails is not worth telling anyone about: the line
        // keeps showing the last good numbers rather than an error.
        if (!cancelled) setPresence(next);
      } catch {
        /* offline, or navigating away mid-request */
      }
    };

    void beat();
    const interval = window.setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  // Two pills that sit beside the hero's status pill, so "how full" and "how
  // busy" read as one row at the very top.
  const pill = "border-border bg-surface/80 text-subtle inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] backdrop-blur";
  return (
    <>
      <span className={pill}>
        <span className="relative flex size-2" aria-hidden>
          <span className="bg-live absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:animate-none" />
          <span className="bg-live relative size-2 rounded-full" />
        </span>
        <strong key={presence.online} className="num num-tick text-foreground font-semibold">{formatCount(presence.online)}</strong>
        online
      </span>
      <span className={pill}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <strong key={presence.total} className="num num-tick text-foreground font-semibold">{formatCount(presence.total)}</strong>
        {presence.total === 1 ? "visit" : "visits"}
      </span>
    </>
  );
}
