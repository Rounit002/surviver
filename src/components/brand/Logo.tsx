import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

/**
 * The tile mark: two cut in coral, one left standing in white, on the
 * structural blue. Flat fills only — the palette carries no gradients.
 *
 * The geometry mirrors `src/app/icon.svg`, which is the favicon Next serves
 * from the file convention, so the two have to be edited together. Colours are
 * literal rather than tokens because the mark also has to hold outside the
 * app, in a browser tab or on an iOS home screen.
 */
const BARS = [
  { x: 5, y: 18, height: 9, fill: "#e0603f" },
  { x: 13, y: 5, height: 22, fill: "#ffffff" },
  { x: 21, y: 18, height: 9, fill: "#e0603f" },
];

function Bars({ animated, fill }: { animated?: boolean; fill?: string }) {
  return (
    <>
      {BARS.map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width="6"
          height={bar.height}
          rx="2"
          fill={fill ?? bar.fill}
          className={animated ? "logo-bar" : undefined}
          // Staggered so a tall bar travels left to right: the board still
          // deciding, rather than three things blinking in unison. Under
          // `prefers-reduced-motion` the animation is dropped and the rects
          // fall back to the attributes above, which are the resolved logo.
          style={animated ? { animationDelay: `${index * 0.14}s` } : undefined}
        />
      ))}
    </>
  );
}

/**
 * The full mark. Decorative by default, since it almost always sits next to
 * the wordmark; pass `title` when it stands alone. `animated` turns it into
 * the loading state.
 */
export function LogoMark({
  animated,
  title,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { animated?: boolean; title?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 32 32"
      // Size with a `size-*` class when a caller needs something other than
      // 24px: CSS beats the presentation attributes above.
      className={cn("shrink-0", className)}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      {...props}
    >
      <rect width="32" height="32" rx="7" fill="#2f52c8" />
      <Bars animated={animated} />
    </svg>
  );
}

/**
 * The bars on their own, in the ink of whatever they sit in — for the small
 * slots the tile is wrong for, chiefly inside a pending button, where a blue
 * tile on a blue button would disappear. Always decorative: the surrounding
 * control carries the wording that tells a screen reader something is running.
 */
export function LogoLoader({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      // Cropped to the bars so the mark fills a button's icon slot instead of
      // sitting in the tile's padding.
      viewBox="4 4 24 24"
      className={cn("shrink-0", className)}
      aria-hidden
      {...props}
    >
      <Bars animated fill="currentColor" />
    </svg>
  );
}
