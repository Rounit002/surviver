import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The one surface primitive: white paper on the warm ground, lifted by a large
 * soft shadow tinted with the same warm dark as the text. Borders stay
 * hairline so a column of panels reads as one stack rather than a grid of
 * boxes.
 */
export function Panel({
  className,
  children,
  elevated = true,
  inset = false,
}: {
  className?: string;
  children: ReactNode;
  /** Cards float; sub-panels inside a card sit flat. */
  elevated?: boolean;
  inset?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border",
        inset ? "bg-muted border-border" : "bg-surface border-border",
        elevated && !inset && "shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3",
        className,
      )}
    >
      <h2 className="label label-bright">{title}</h2>
      {action}
    </div>
  );
}

export function PanelBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
