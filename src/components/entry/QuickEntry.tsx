import { CATEGORY_LABELS, CATEGORY_VALUES } from "@/lib/competition/constants";
import { Icon } from "@/components/ui/Icon";

export function QuickEntry({ available, full = false }: { available: boolean; full?: boolean }) {
  return <form action="/enter" className="mx-auto mt-7 flex max-w-3xl flex-col gap-2.5 md:flex-row">
    <div className="relative min-w-0 flex-1">
      <Icon name="globe" className="text-subtle absolute top-3.5 left-4" />
      <label htmlFor="quick-url" className="sr-only">Your product URL</label>
      <input id="quick-url" name="url" required maxLength={2048} inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} placeholder="Your product URL" className="border-border bg-surface h-12 w-full rounded-full border pr-4 pl-12 text-base sm:text-sm" />
    </div>
    <label className="sr-only" htmlFor="quick-category">Category</label>
    <select id="quick-category" name="category" defaultValue="" required className="border-border bg-surface text-subtle h-12 rounded-full border px-5 text-base sm:text-sm md:w-48">
      <option value="" disabled>Choose a category</option>
      {CATEGORY_VALUES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
    </select>
    <button disabled={!available} className="bg-primary text-primary-foreground flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{available ? "Enter your product" : full ? "All spots filled" : "Opening soon"}<Icon name="arrow" width="16" /></button>
  </form>;
}
