import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The one button.
 *
 * Rectangular with soft corners rather than a pill. A pill is the right shape
 * for something that reads as a tag — a status, a category — and using it for
 * actions as well leaves nothing to tell the two apart at a glance.
 *
 * The press is a one-pixel drop and a slight darkening, nothing more. A button
 * that scales under the cursor draws attention to the button; this draws
 * attention to the fact that it responded.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground border border-primary font-medium shadow-raised " +
    "hover:brightness-110 active:translate-y-px",
  secondary:
    "bg-surface text-foreground border border-border font-medium shadow-raised " +
    "hover:border-border-strong hover:bg-muted active:translate-y-px",
  ghost:
    "bg-transparent text-subtle border border-transparent " +
    "hover:text-foreground hover:bg-muted",
  danger:
    "bg-transparent text-danger border border-danger/30 font-medium hover:bg-danger/8",
  gold:
    "bg-gold text-background border border-gold font-medium shadow-raised " +
    "hover:brightness-110 active:translate-y-px",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-9 px-3 py-1.5 text-[13px] gap-1.5 rounded-[8px]",
  md: "min-h-10 px-4 py-2 text-sm gap-2 rounded-[10px]",
  lg: "min-h-12 px-5.5 py-3 text-[15px] gap-2 rounded-[12px]",
};

// Note: `inline-flex` here will beat a `hidden` passed through `className`,
// because Tailwind orders display utilities in the stylesheet rather than by
// the order they appear in the attribute. To hide a button responsively, wrap
// it in an element that carries the visibility classes.
const BASE =
  "inline-flex max-w-full items-center justify-center text-center select-none cursor-pointer " +
  "transition-[background-color,border-color,filter,transform,box-shadow] " +
  "duration-[var(--dur-fast)] ease-[var(--ease-out)] " +
  "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

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
