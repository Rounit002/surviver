import { siDiscord, siYoutube } from "simple-icons";

/**
 * YouTube and Discord marks, from Simple Icons (CC0 artwork).
 *
 * Both brands ask for their mark to be used unmodified and in its own colour:
 * Discord's Blurple (#5865F2) and YouTube's red (#FF0000). So the colour is
 * fixed here rather than inherited from the text around it.
 */
const BRANDS = {
  youtube: { path: siYoutube.path, color: `#${siYoutube.hex}`, title: "YouTube" },
  discord: { path: siDiscord.path, color: `#${siDiscord.hex}`, title: "Discord" },
} as const;

export type Brand = keyof typeof BRANDS;

export function BrandIcon({ brand, size = 18, mono = false, className }: { brand: Brand; size?: number; mono?: boolean; className?: string }) {
  const { path, color } = BRANDS[brand];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} fill={mono ? "currentColor" : color}>
      <path d={path} />
    </svg>
  );
}

/** Where the extra exposure happens. One place, so every link stays in step. */
export const SOCIAL_LINKS = {
  youtube: "https://www.youtube.com/@rounieee",
  discord: "https://discord.gg/PeEbj4CB7U",
} as const;
