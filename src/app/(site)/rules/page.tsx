import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getCurrentSeason, getOpenSeason } from "@/lib/competition/season";
import { formatMoney } from "@/lib/format";
export const metadata = pageMetadata("/rules");
export const dynamic = "force-dynamic";
export default async function RulesPage() {
  const season = await getOpenSeason() ?? await getCurrentSeason();
  return <article className="mx-auto w-full max-w-2xl px-4 py-10">
    <p className="label">The playing field</p><h1 className="mt-3 text-3xl font-semibold">Simple rules. Earned attention.</h1>
    <p className="text-subtle mt-4 text-sm leading-7">A promotional tournament for SaaS products. Every entry costs the same, and paying more cannot improve a rank.</p>
    <div className="mt-8 space-y-8 text-sm leading-7">
      <section id="entry-fees"><h2 className="text-lg font-semibold">01 / Entering a season</h2><p className="text-subtle mt-2">{season ? `${season.name}: ${season.capacity} products at ${formatMoney(season.entryPriceCents, season.currency)} per entry.` : "Capacity and pricing are published when a season opens."} Checkout is simulated, so no money is charged. Every paid entry is reviewed by hand, rejected ones are recorded as refunded, and a season starts once at least two are approved.</p></section>
      <section><h2 className="text-lg font-semibold">02 / What counts</h2><p className="text-subtle mt-2">A qualified view is half the card visible in an active tab for one second, counted once per visitor and product every {season?.impressionDedupSec ?? 1800} seconds. A scoring visit needs a prior qualified view, and counts once per visitor, product, and round. Cookie-free visits and detected bots never score.</p></section>
      <section><h2 className="text-lg font-semibold">03 / Advancing and elimination</h2><p className="text-subtle mt-2">Interest Rate is verified visits divided by qualified views, and a product needs {season?.minSampleImpressions ?? 250} qualified views to be ranked. At the deadline the lowest ranked go out; if any product is short on data, the round extends by an hour. Ties break on verified visits, then a stable entry identifier. Every round starts with fresh scores, and finished results are frozen.</p></section>
      <section><h2 className="text-lg font-semibold">04 / Rally responsibly</h2><p className="text-subtle mt-2">Your Rally link brings visitors to the whole board. A visitor earns you a Rally point after qualified views on two other products, and your own referred traffic never scores for you. Rally points add exposure only, capped at {Math.round((season?.rallyBonusCap ?? 0.15) * 100)}%.</p></section>
      <section><h2 className="text-lg font-semibold">05 / The survivor</h2><p className="text-subtle mt-2">The last product standing is recorded as the season survivor and kept in the archive for good. There is no cash prize.</p></section>
    </div><Link href="/enter" className="text-primary mt-8 inline-block text-sm font-semibold">Enter your product →</Link>
  </article>;
}
