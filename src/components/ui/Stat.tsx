import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Label above, figure below. The figure carries tabular figures so a column of
 * stats aligns on the decimal point and does not shuffle as numbers tick.
 */
export function Stat({
  label,
  value,
  hint,
  tone,
  size = "md",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const valueSize =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";

  return (
    <div className={cn("min-w-0", className)}>
      <div className="label">{label}</div>
      <div
        className={cn(
          "num mt-1.5 leading-none font-semibold",
          valueSize,
          tone ?? "text-foreground",
        )}
      >
        {value}
      </div>
      {hint ? <div className="text-faint mt-1.5 text-[11px]">{hint}</div> : null}
    </div>
  );
}

/** A row of stats separated by hairlines, as on a broadcast lower third. */
export function StatRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-border grid divide-y sm:divide-x sm:divide-y-0 [&>*]:px-4 [&>*]:py-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
