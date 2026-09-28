import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { FIELD_SIZE } from "@/lib/competition/constants";
export const metadata = pageMetadata("/how-it-works");

const STEPS = [
  {
    n: "01",
    title: `${FIELD_SIZE} spots open`,
    text: "Pay the flat fee and your product is listed straight away as part of the lineup.",
    tone: "var(--cat-dev-tools-tint)",
    ink: "var(--cat-dev-tools-ink)",
  },
  {
    n: "02",
    title: "Season starts at 32",
    text: `Nothing is ranked until all ${FIELD_SIZE} spots are paid. Then the board goes live for everyone at once.`,
    tone: "var(--cat-productivity-tint)",
    ink: "var(--cat-productivity-ink)",
  },
  {
    n: "03",
    title: "Clicks set the rank",
    text: "Every product stays live all season. Real visits move you up. Nobody is cut.",
    tone: "var(--cat-founder-tools-tint)",
    ink: "var(--cat-founder-tools-ink)",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <article className="shell section">
      <div className="max-w-2xl">
        <p className="eyebrow">How it works</p>
        <h1 className="text-title mt-3 font-semibold">Real clicks are the score.</h1>
        <p className="text-subtle text-lead mt-3">
          A fixed field of {FIELD_SIZE}. Equal exposure. Every product is live for the whole season.
        </p>
      </div>

      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.n} className="card-lift bg-surface border-border rounded-[20px] border p-6">
            <span
              className="mono inline-flex size-9 items-center justify-center rounded-[10px] text-sm font-bold"
              style={{ backgroundColor: step.tone, color: step.ink }}
            >
              {step.n}
            </span>
            <h2 className="mt-5 text-lg font-semibold">{step.title}</h2>
            <p className="text-subtle mt-1.5 text-sm leading-relaxed">{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="bg-primary text-primary-foreground rounded-[20px] p-6">
          <p className="text-sm font-semibold opacity-80">What counts as a click</p>
          <p className="mt-2 text-xl font-semibold">One per visitor, per product, per season.</p>
          <p className="mt-2 text-sm opacity-85">
            A click only scores after the visitor was actually shown the product. Repeats, bots and scripted traffic don’t count.
          </p>
        </div>
        <div className="border-border bg-surface rounded-[20px] border p-6">
          <p className="text-subtle text-sm font-semibold">Ties and the winner</p>
          <p className="mt-2 text-xl font-semibold">Most clicks at the end is crowned Survivor.</p>
          <p className="text-subtle mt-2 text-sm">
            Equal clicks share a rank. At the finish, a tie is broken by the share of viewers who clicked.
          </p>
        </div>
      </div>

      <Link href="/rules" className="text-primary mt-8 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
        Full rules
        <Icon name="arrow" width="14" height="14" />
      </Link>
    </article>
  );
}
