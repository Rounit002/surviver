"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatCount } from "@/lib/format";
import type { Presence } from "@/lib/tracking/presence";

/**
 * Two chips beside the season badge: how many people are here now, and how
 * many have been.
 *
 * Badges rather than a line of text, because they sit in a row with the season
 * badge and three pills read as one status strip where a pill next to a
 * sentence reads as a mistake.
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

  return (
    <>
      <Badge>
        <Icon name="users" width="14" height="14" className="text-faint shrink-0" />
        <span className="inline-flex items-center gap-1.5">
          <span className="pulse-dot bg-safe inline-block size-1.5 rounded-full" aria-hidden />
          <span className="num text-foreground font-medium">{formatCount(presence.online)}</span>{" "}
          online
        </span>
      </Badge>
      <Badge>
        <Icon name="bars" width="14" height="14" className="text-faint shrink-0" />
        <span>
          <span className="num text-foreground font-medium">{formatCount(presence.total)}</span>{" "}
          {presence.total === 1 ? "visit" : "visits"}
        </span>
      </Badge>
    </>
  );
}
