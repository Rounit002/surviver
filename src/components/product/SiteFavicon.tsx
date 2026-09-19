"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

export function SiteFavicon({ name, siteUrl, logoUrl }: { name: string; siteUrl: string; logoUrl: string | null }) {
  const host = (() => {
    try {
      return new URL(siteUrl).hostname;
    } catch {
      return "";
    }
  })();
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = [
    host ? `https://${host}/favicon.ico` : "",
    logoUrl ?? "",
    host ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico` : "",
  ].filter((source, index, all) => source && all.indexOf(source) === index);
  const favicon = sources[sourceIndex];

  return (
    <div className="border-border bg-muted/50 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border">
      {favicon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={favicon}
          alt={`${name} favicon`}
          loading="lazy"
          decoding="async"
          width={40}
          height={40}
          onError={() => setSourceIndex((index) => index + 1)}
          className="size-full object-contain p-1"
        />
      ) : (
        <Icon name="globe" width="20" height="20" className="text-faint" />
      )}
    </div>
  );
}
