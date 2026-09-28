import { pageMetadata } from "@/lib/seo";
import { getCurrentSeason, getOpenSeason } from "@/lib/competition/season";
import { CHECKOUT_HOLD_MS, FIELD_SIZE } from "@/lib/competition/constants";
import { formatMoney } from "@/lib/format";
import { EnterButton } from "@/components/entry/EnterButton";
export const metadata = pageMetadata("/rules");
export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const season = (await getOpenSeason()) ?? (await getCurrentSeason());
  const price = season ? formatMoney(season.entryPriceCents, season.currency) : null;
  const days = Math.round((season?.seasonLengthHours ?? 720) / 24);
  const holdMinutes = CHECKOUT_HOLD_MS / 60_000;

  const rules: { id?: string; title: string; body: string }[] = [
    {
      id: "entry-fees",
      title: "Entering",
      body: `Every season has exactly ${FIELD_SIZE} spots${price ? ` at ${price} each` : ""}. Checkout is handled by Dodo Payments, and paying takes your spot straight away. Starting checkout holds a spot for ${holdMinutes} minutes so it can’t be sold twice. If a payment still arrives after the field is full, it is refunded automatically in full.`,
    },
    {
      title: "When it starts",
      body: `Nothing is ranked until all ${FIELD_SIZE} spots are paid. The moment the last one is, the season goes live for everyone and runs for ${days} days.`,
    },
    {
      title: "How ranking works",
      body: "Products are ranked by clicks. A click counts once per visitor per product for the whole season, only after that visitor was shown the product, and at most once per network per day. Bots, cookie-free visits and your own Rally traffic never count. Equal clicks share a rank.",
    },
    {
      title: "Nobody is cut",
      body: `All ${FIELD_SIZE} products stay on the board for the whole season. The board order is shuffled per visitor and favours products that have been seen least, so exposure stays equal and rank can’t buy position.`,
    },
    {
      title: "Rally responsibly",
      body: `Your Rally link brings visitors to the whole board. A visitor earns you a Rally point after viewing two other products. Rally points add exposure only, capped at ${Math.round((season?.rallyBonusCap ?? 0.15) * 100)}%.`,
    },
    {
      title: "The Survivor",
      body: "The product with the most clicks when the season ends is crowned Survivor and kept in the Hall of Survivors for good. A tie at the top is broken by the share of viewers who clicked. There is no cash prize.",
    },
  ];

  return (
    <article className="shell section max-w-3xl">
      <p className="eyebrow">Rules</p>
      <h1 className="text-title mt-3 font-semibold">Simple rules. Earned attention.</h1>
      <p className="text-subtle mt-3">Everyone pays the same. Paying more can’t improve a rank.</p>

      <ol className="mt-10 space-y-3">
        {rules.map((rule, index) => (
          <li key={rule.title} id={rule.id} className="border-border bg-surface flex gap-5 rounded-[18px] border p-5 sm:p-6">
            <span className="mono bg-primary-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-[9px] text-xs font-bold">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="font-semibold">{rule.title}</h2>
              <p className="text-subtle mt-1.5 text-sm leading-relaxed">{rule.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <EnterButton className="text-primary mt-8 inline-block text-sm font-semibold hover:underline">
        Enter. Earn your spot. →
      </EnterButton>
    </article>
  );
}
