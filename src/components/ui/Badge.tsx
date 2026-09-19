import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The small pill above a headline, and nothing else.
 *
 * It exists to say one short true thing before the reader commits to reading
 * the headline — which season is open, how many spots are left. If it has
 * nothing specific to say it should not be rendered at all; a badge reading
 * "Welcome" is decoration wearing the costume of information.
 *
 * Pill-shaped on purpose. In this system a pill means a tag, a rectangle with
 * soft corners means an action, and keeping those apart is what lets a reader
 * tell at a glance which things on a page can be clicked.
 */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  /** `accent` for something live or open, `neutral` for everything else. */
  tone?: "neutral" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-3 text-[13px] leading-none",
        tone === "accent"
          ? "border-primary/20 bg-primary-soft text-primary"
          : "border-border bg-surface text-subtle",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The dot that goes inside a badge when the thing it describes is happening
 * right now. Separate from `LiveDot` in `Chip`, which pulses: at badge size,
 * next to a headline, a pulsing dot is the loudest thing on the screen.
 */
export function BadgeDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("bg-primary inline-block size-1.5 shrink-0 rounded-full", className)}
    />
  );
}
