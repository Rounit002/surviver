import Link from "next/link";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/brand/Logo";

/**
 * The lockup: tile mark plus the typographic stop. Tight negative tracking and
 * a coloured stop, matching the compact lockups these leaderboard sites use in
 * a 22px header slot.
 */
export function Wordmark({
  className,
  href = "/",
  size = "md",
}: {
  className?: string;
  href?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  // The default steps down on small phones so it cannot collide with the nav
  // links sharing the header row at 320px.
  const sizes = {
    sm: "text-[16px]",
    md: "text-[18px] sm:text-[22px]",
    lg: "text-[24px] sm:text-[28px]",
  } as const;

  // The mark tracks the type rather than sitting at a fixed size, so the
  // lockup keeps its proportions at every step.
  const markSizes = {
    sm: "size-[18px]",
    md: "size-5 sm:size-6",
    lg: "size-[26px] sm:size-[30px]",
  } as const;

  // The gap closes a little on the small step, where the mark is nearer the
  // cap height and a wide gap would read as two separate things.
  const gaps = { sm: "gap-1.5", md: "gap-2", lg: "gap-2.5" } as const;

  const content = (
    <span className={cn("inline-flex items-center", gaps[size], className)}>
      {/* Decorative: the wordmark beside it already says the name. */}
      <LogoMark className={markSizes[size]} />
      <span className={cn("font-medium tracking-[-0.04em] whitespace-nowrap", sizes[size])}>
        <span className="text-foreground">surviver</span>
        {/* Coral, as in the design canvas: the stop is the one place the accent
            appears in the chrome, so it does not compete with the blue actions. */}
        <span className="text-danger">.lol</span>
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex min-h-11 items-center" aria-label="Surviver.lol home">
      {content}
    </Link>
  );
}
