import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-md border border-border bg-surface px-3.5 text-sm text-foreground " +
  "placeholder:text-faint transition-colors " +
  "hover:border-border-strong focus:border-primary focus:outline-none " +
  "disabled:opacity-50 disabled:bg-muted aria-[invalid=true]:border-danger";

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="label label-bright block">
        {label}
        {required ? <span className="text-danger ml-1">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-danger text-[12px]">{error}</p>
      ) : hint ? (
        <p className="text-faint text-[12px]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-11", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-24 py-2.5 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={cn(CONTROL, "h-11 appearance-none pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

/** Server action error banner. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="border-danger/25 bg-danger/8 text-danger rounded-md border px-3.5 py-2.5 text-[13px]"
    >
      {children}
    </div>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="border-safe/25 bg-safe/8 text-safe rounded-md border px-3.5 py-2.5 text-[13px]">
      {children}
    </div>
  );
}
