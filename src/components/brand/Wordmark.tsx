import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Typographic mark. Tight negative tracking and a coloured stop, matching the
 * compact lockups these leaderboard sites use in a 22px header slot.
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

  const content = (
    <span
      className={cn(
        "font-medium tracking-[-0.04em] whitespace-nowrap",
        sizes[size],
        className,
      )}
    >
      <span className="text-foreground">surviver</span>
      {/* Coral, as in the design canvas: the stop is the one place the accent
          appears in the chrome, so it does not compete with the blue actions. */}
      <span className="text-danger">.lol</span>
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex items-center" aria-label="Surviver.lol home">
      {content}
    </Link>
  );
}
