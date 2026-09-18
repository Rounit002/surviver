import type { ReactElement, SVGProps } from "react";

/**
 * The playful half of the wallpaper's vocabulary.
 *
 * `DoodleField` draws most of its marks from the two sets the app already
 * ships — `Icon` and `CategoryIcon` — but those are all work glyphs: bar
 * charts, pen nibs, angle brackets. These are the ones a doodle field needs
 * and the product itself had no reason to own.
 *
 * Same construction as the other two sets: a 24-unit box, line only, one
 * stroke weight, round joins. A star sitting next to the analytics bars has to
 * read as the same hand, otherwise the background turns into a sticker sheet.
 */
export type DoodleName =
  | "star"
  | "heart"
  | "rocket"
  | "controller"
  | "smile"
  | "dice"
  | "squiggle"
  | "flag"
  | "crown"
  | "cursor"
  | "bolt";

const PATHS: Record<DoodleName, ReactElement> = {
  // Five-pointed, struck from a 9.2 outer and 3.9 inner radius so the arms
  // stay fat enough to survive at 30px.
  star: (
    <path d="M12 2.8 14.29 8.85 20.75 9.16 15.71 13.21 17.41 19.44 12 15.9 6.59 19.44 8.29 13.21 3.25 9.16 9.71 8.85Z" />
  ),
  heart: (
    <path d="M12 20.3 4.9 13.4a4.35 4.35 0 0 1 0-6.2 4.4 4.4 0 0 1 6.2 0l.9.9.9-.9a4.4 4.4 0 0 1 6.2 0 4.35 4.35 0 0 1 0 6.2L12 20.3Z" />
  ),
  rocket: (
    <>
      <path d="M12 2.6c3 2.5 4.6 6.1 4.6 9.9l-1.6 4h-6l-1.6-4c0-3.8 1.6-7.4 4.6-9.9Z" />
      <circle cx="12" cy="10.2" r="2" />
      <path d="M8.4 13.4 5.6 16a3.4 3.4 0 0 0-1 2.4v1.8l2.7-1.3M15.6 13.4 18.4 16a3.4 3.4 0 0 1 1 2.4v1.8l-2.7-1.3" />
      <path d="M10.6 19.4 12 21.8l1.4-2.4" />
    </>
  ),
  controller: (
    <>
      <path d="M7.6 7.6h8.8a5 5 0 0 1 4.92 4.1l.78 4.3a2.55 2.55 0 0 1-4.63 1.93l-1.54-2.23H8.07l-1.54 2.23A2.55 2.55 0 0 1 1.9 16l.78-4.3a5 5 0 0 1 4.92-4.1Z" />
      <path d="M7.6 11.1v2.6M6.3 12.4h2.6" />
      <path d="M15.7 11.9v.01M17.7 13.7v.01" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.3 14.1a4.45 4.45 0 0 0 7.4 0" />
      <path d="M9.2 9.5v.01M14.8 9.5v.01" />
    </>
  ),
  // Zero-length segments render as dots under `stroke-linecap: round`, which
  // keeps the five pips on the same stroke as the shell.
  dice: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M8.4 8.4v.01M15.6 8.4v.01M12 12v.01M8.4 15.6v.01M15.6 15.6v.01" />
    </>
  ),
  squiggle: <path d="M2.6 15.4c1.9-3.4 3.8-3.4 5.7 0s3.8 3.4 5.7 0 3.8-3.4 5.7 0" />,
  crown: (
    <>
      <path d="M3.2 7.6 6.4 14h11.2l3.2-6.4-4.6 2.7L12 4.2 7.8 10.3 3.2 7.6Z" />
      <path d="M6.7 17.6h10.6" />
    </>
  ),
  cursor: <path d="M5.4 3.6 18.9 11l-5.9 1.8L10.2 18 5.4 3.6Z" />,
  // Lightning. The same bolt the AUTOMATION category draws, kept here so the
  // wallpaper does not have to reach into the product's category set for one
  // shape that has nothing to do with categories.
  bolt: <path d="M13 2.5 5.5 13H11l-.5 8.5L18.5 11H13V2.5Z" />,
  flag: (
    <>
      <path d="M6 21.2V4" />
      <path d="M6 5.1c4-2.1 8 2.1 12 0v7.6c-4 2.1-8-2.1-12 0Z" />
    </>
  ),
};

export function Doodle({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: DoodleName }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
