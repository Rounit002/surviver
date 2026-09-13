import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground font-medium border border-primary " +
    "hover:bg-primary/90 active:translate-y-px shadow-raised",
  secondary:
    "bg-surface text-foreground border border-border font-medium " +
    "hover:border-border-strong hover:bg-muted active:translate-y-px shadow-raised",
  ghost:
    "bg-transparent text-subtle border border-transparent " +
    "hover:text-foreground hover:bg-muted",
  danger:
    "bg-transparent text-danger border border-danger/30 font-medium hover:bg-danger/8",
  gold: "bg-gold text-background font-medium border border-gold hover:bg-gold/90 shadow-raised",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-11 sm:min-h-8 px-3.5 py-2 text-[13px] gap-1.5",
  md: "min-h-11 sm:min-h-10 px-4.5 py-2 text-sm gap-2",
  lg: "min-h-12 px-6 py-3 text-[15px] gap-2",
};

// Note: `inline-flex` here will beat a `hidden` passed through `className`,
// because Tailwind orders display utilities in the stylesheet rather than by
// the order they appear in the attribute. To hide a button responsively, wrap
// it in an element that carries the visibility classes.
const BASE =
  "inline-flex max-w-full items-center justify-center rounded-full text-center transition-all duration-150 " +
  "disabled:opacity-50 disabled:pointer-events-none whitespace-normal [overflow-wrap:anywhere] select-none cursor-pointer";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </Link>
  );
}

/** For outbound destinations that must leave the app through a tracking route. */
export function ButtonAnchor({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<"a">) {
  return (
    <a className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </a>
  );
}
