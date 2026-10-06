"use client";

import { useEffect, useState } from "react";

/**
 * The main colour of a product's icon, for tinting the card it sits in.
 *
 * Reads the icon through `/api/favicon` (same origin, so the canvas stays
 * readable), samples it small, and keeps the most common saturated hue — the
 * brand colour, not the white or black around it. A monochrome icon has no
 * such hue and resolves to `null`, which callers treat as "keep the neutral
 * border". Results are shared per host, so a logo is only sampled once.
 */
const cache = new Map<string, Promise<string | null>>();

export function useLogoColor(siteUrl: string): string | null {
  const host = hostOf(siteUrl);
  const [color, setColor] = useState<{ host: string; value: string | null } | null>(null);

  useEffect(() => {
    if (!host) return;
    let live = true;
    let pending = cache.get(host);
    if (!pending) {
      pending = sample(host);
      cache.set(host, pending);
    }
    pending.then((value) => {
      if (live) setColor({ host, value });
    });
    return () => {
      live = false;
    };
  }, [host]);

  return color && color.host === host ? color.value : null;
}

function sample(host: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(dominant(ctx.getImageData(0, 0, size, size).data));
      } catch {
        resolve(null);
      }
    };
    img.src = `/api/favicon?host=${encodeURIComponent(host)}`;
  });
}

/** The heaviest of twelve hue buckets, weighted by saturation, averaged. */
function dominant(data: Uint8ClampedArray): string | null {
  const buckets = Array.from({ length: 12 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.28 || max < 60) continue;
    let hue = 0;
    if (max === r) hue = ((g - b) / (max - min) + 6) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    const bucket = buckets[Math.floor(hue * 2) % 12];
    bucket.weight += sat;
    bucket.r += r * sat;
    bucket.g += g * sat;
    bucket.b += b * sat;
  }
  const best = buckets.reduce((a, b) => (b.weight > a.weight ? b : a));
  // Too few coloured pixels to call it a brand colour.
  if (best.weight < 6) return null;
  const channel = (v: number) => Math.round(v / best.weight);
  return `rgb(${channel(best.r)} ${channel(best.g)} ${channel(best.b)})`;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
