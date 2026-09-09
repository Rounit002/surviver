import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { COMPETITIVE_STATUS } from "@/lib/competition/constants";
import type { CompetitiveStatus } from "@/generated/prisma";

export function Chip({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "label inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "bg-muted border-border text-subtle",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusChip({
  status,
  className,
}: {
  status: CompetitiveStatus;
  className?: string;
}) {
  const presentation = COMPETITIVE_STATUS[status];
  return (
    <Chip title={presentation.description} className={cn(presentation.chip, className)}>
      {status === "ELIMINATION_ZONE" ? <span aria-hidden>&#9760;</span> : null}
      {presentation.label}
    </Chip>
  );
}

/** The pulsing marker that says data on this page is moving right now. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      className={cn("pulse-dot bg-primary inline-block h-1.5 w-1.5 rounded-full", className)}
      aria-hidden
    />
  );
}

export function LiveBadge({ label = "Live" }: { label?: string }) {
  return (
    <span className="label text-primary inline-flex items-center gap-1.5">
      <LiveDot />
      {label}
    </span>
  );
}

/** Required disclosure that entries are paid placements (PRD 16). */
export function SponsoredTag({ className }: { className?: string }) {
  return (
    <span
      className={cn("label text-faint", className)}
      title="Founders pay a flat entry fee to compete. Ranking cannot be purchased."
    >
      Sponsored Contestant
    </span>
  );
}
