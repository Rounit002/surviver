import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/ui/Reveal";

/**
 * The top of a section: an optional eyebrow, a title, and an optional line of
 * supporting copy.
 *
 * One component rather than each section rolling its own, because the thing
 * that makes a long page read as designed is that the distance from eyebrow to
 * title, and from title to copy, is the same everywhere. That is easy to agree
 * on and almost impossible to maintain by hand.
 *
 * The eyebrow takes the mono label style, which is the same voice the board
 * uses for ROUND 2 and INTEREST RATE — so a section heading sounds like the
 * rest of the product rather than like marketing bolted on top.
 */
export function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "start",
  as: Tag = "h2",
  className,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  copy?: ReactNode;
  align?: "start" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
  /** A single link or button, right-aligned on wide screens. */
  action?: ReactNode;
}) {
  const centred = align === "center";
  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        // `!!` because a ReactNode can be 0 or "", which `cn` does not accept.
        !!action && !centred && "md:flex-row md:items-end md:justify-between md:gap-10",
        className,
      )}
    >
      <Reveal className={cn("flex flex-col", centred && "mx-auto items-center text-center")}>
        {eyebrow ? <p className="label mb-4">{eyebrow}</p> : null}
        <Tag className="text-title font-semibold">{title}</Tag>
        {copy ? (
          <p className={cn("text-subtle text-lead measure mt-4", centred && "mx-auto")}>{copy}</p>
        ) : null}
      </Reveal>
      {action ? (
        <Reveal delay={80} className={cn("shrink-0", centred && "mx-auto")}>
          {action}
        </Reveal>
      ) : null}
    </div>
  );
}
