import { LogoMark } from "@/components/brand/Logo";

export default function BoardLoading() {
  return (
    <div className="shell py-10" aria-busy>
      <div className="flex items-center gap-2.5" role="status">
        <LogoMark animated className="size-7" />
        <span className="label">Loading the board</span>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-lg border border-border bg-surface shadow-tile" />
        ))}
      </div>
    </div>
  );
}
