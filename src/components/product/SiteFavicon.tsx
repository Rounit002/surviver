"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A product's icon, or its initial when there is none.
 *
 * Icons come through a neutral icon service only. Loading
 * `https://<entrant>/favicon.ico` directly would hand every board viewer's IP
 * address to the products being ranked, and let an entrant serve something
 * different to each viewer.
 */
export function SiteFavicon({ name, siteUrl, logoUrl, className }: { name: string; siteUrl: string; logoUrl: string | null; className?: string }) {
  const host = (() => {
    try {
      return new URL(siteUrl).hostname;
    } catch {
      return "";
    }
  })();
  const sources = [
    host ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico` : "",
    logoUrl?.startsWith("https://icons.duckduckgo.com/") ? logoUrl : "",
  ].filter((source, index, all) => source && all.indexOf(source) === index);
  const [sourceIndex, setSourceIndex] = useState(0);
  const image = useRef<HTMLImageElement>(null);
  const favicon = sources[sourceIndex];

  // A server-rendered <img> can fail before React attaches `onError`, which
  // left the browser's broken-image glyph showing. Check once on mount.
  useEffect(() => {
    const el = image.current;
    if (el && el.complete && el.naturalWidth === 0) setSourceIndex((index) => index + 1);
  }, [sourceIndex]);

  const initial = (name.trim()[0] ?? host[0] ?? "?").toUpperCase();

  return (
    <div className={cn("border-border bg-surface flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border", className)}>
      {favicon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={image}
          src={favicon}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          width={40}
          height={40}
          onError={() => setSourceIndex((index) => index + 1)}
          className="size-full object-contain p-1"
        />
      ) : (
        <span aria-hidden className="text-primary text-sm font-bold">{initial}</span>
      )}
    </div>
  );
}
