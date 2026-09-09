export default function SiteLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10" aria-busy>
      <div className="label text-faint">Loading</div>
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
