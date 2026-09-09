import type { ReactElement, SVGProps } from "react";
import type { ProductCategory } from "@/generated/prisma";

/**
 * A mark per category, drawn in the same stroke style as `Icon`.
 *
 * The board already colour-codes categories; giving each one a shape as well
 * means the rail can be scanned at a glance rather than read word by word. The
 * glyphs stay line-only at a single weight so ten of them in a row read as one
 * set instead of ten logos.
 */
const PATHS: Record<ProductCategory, ReactElement> = {
  // Sparkle: the house style for anything generative.
  AI: (
    <>
      <path d="M10 3.5 11.7 8.3 16.5 10 11.7 11.7 10 16.5 8.3 11.7 3.5 10 8.3 8.3 10 3.5Z" />
      <path d="m17.5 14.5.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
    </>
  ),
  // Angle brackets.
  DEV_TOOLS: <path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5" />,
  // Checked box.
  PRODUCTIVITY: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="m8.5 12.2 2.6 2.6 4.9-5.4" />
    </>
  ),
  // Megaphone.
  MARKETING: (
    <>
      <path d="M4 10.5v3A1.5 1.5 0 0 0 5.5 15H8l7 4.5v-15L8 9H5.5A1.5 1.5 0 0 0 4 10.5Z" />
      <path d="M18.5 9.5a4 4 0 0 1 0 5" />
    </>
  ),
  // Pen nib.
  DESIGN: (
    <>
      <path d="M4.5 19.5 5.5 16l9.6-9.6a2.05 2.05 0 0 1 2.9 2.9L8.4 18.9l-3.9.6Z" />
      <path d="m13.5 8 2.9 2.9" />
    </>
  ),
  // Lightbulb.
  FOUNDER_TOOLS: (
    <>
      <path d="M12 3.5A5.8 5.8 0 0 0 8.6 14c.6.5 1 1.2 1 2v.5h4.8V16c0-.8.4-1.5 1-2A5.8 5.8 0 0 0 12 3.5Z" />
      <path d="M9.8 19.5h4.4M10.6 21.5h2.8" />
    </>
  ),
  // Bolt.
  AUTOMATION: <path d="M13 2.5 5.5 13H11l-.5 8.5L18.5 11H13V2.5Z" />,
  // Stacked layers: built, not written.
  NO_CODE: (
    <>
      <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" />
      <path d="m3.5 13 8.5 4.5 8.5-4.5" />
    </>
  ),
  // Bar chart.
  ANALYTICS: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M7 20.5v-5M11.7 20.5V8M16.4 20.5v-7" />
    </>
  ),
  // Video camera.
  CREATOR: (
    <>
      <rect x="2.5" y="6.5" width="12" height="11" rx="3" />
      <path d="m14.5 10.5 6-3v9l-6-3v-3Z" />
    </>
  ),
};

export function CategoryIcon({
  category,
  ...props
}: SVGProps<SVGSVGElement> & { category: ProductCategory }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[category]}
    </svg>
  );
}
