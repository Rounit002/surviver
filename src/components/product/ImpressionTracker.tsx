"use client";
import { useEffect, useRef } from "react";
export function ImpressionTracker({ entryId, proof }: { entryId: string; proof: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const card = anchor.current?.closest("article");
    if (!card) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sent = false;
    let visible = false;
    const cancel = () => { clearTimeout(timer); };
    const schedule = () => {
      cancel();
      if (!visible || sent || document.visibilityState !== "visible") return;
      timer = setTimeout(async () => {
        sent = true;
        try { const response = await fetch("/api/impressions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryId, proof, dwellMs: 1000 }), keepalive: true }); if (!response.ok) sent = false; } catch { sent = false; }
      }, 1100);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.intersectionRatio >= 0.5; schedule(); }, { threshold: [0, 0.5] });
    observer.observe(card);
    document.addEventListener("visibilitychange", schedule);
    return () => { cancel(); observer.disconnect(); document.removeEventListener("visibilitychange", schedule); };
  }, [entryId, proof]);
  return <span ref={anchor} hidden />;
}
