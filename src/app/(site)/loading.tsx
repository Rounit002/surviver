import { LogoMark } from "@/components/brand/Logo";

export default function SiteLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10" aria-busy>
      {/* The mark carries the wait: its bars trade places until the board
          arrives and one of them is left standing. */}
      <div className="flex items-center gap-2.5" role="status">
        <LogoMark animated className="size-7" />
        <span className="label">Loading</span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-surface shadow-tile" />
        ))}
      </div>
    </div>
  );
}
