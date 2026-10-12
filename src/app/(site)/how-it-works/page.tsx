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
    title: `Season starts when all ${FIELD_SIZE} spots fill`,
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

const FAQS = [
  {
    question: "What is Surviver.lol?",
    answer: "Surviver.lol is a SaaS launch and product discovery platform. Each season gives 32 SaaS products, AI tools, startups, and developer products equal visibility and ranks them by verified visitor clicks.",
  },
  {
    question: "Where can I submit my SaaS product for discovery?",
    answer: "You can submit your SaaS product to an open Surviver.lol season. Once payment is confirmed, it joins the public lineup. The discovery board goes live when all spots are filled, and listings stay up for the full season.",
  },
  {
    question: "Can I launch an AI tool or developer product here?",
    answer: "Yes. Open seasons accept SaaS products, AI tools, startups, and developer products. Once payment is confirmed, the product joins the public lineup and appears on the discovery board when its season goes live.",
  },
  {
    question: "Is Surviver.lol a Product Hunt alternative?",
    answer: "It is another product launch and discovery channel, with season-long listings and rankings based on verified clicks. It is not a replacement for launch communities, and a listing does not guarantee traffic or customers.",
  },
  {
    question: "Will a listing guarantee visitors or customers?",
    answer: "No. Products receive the same season-long placement rules, but visitor numbers, clicks, signups, and sales are not guaranteed. Rankings reflect verified visitor clicks, not paid position.",
  },
  {
    question: "How are products ranked?",
    answer: "Products are ranked by verified clicks from real visitors. Repeat clicks, bots, and scripted traffic do not increase the score, and paid placement cannot buy a higher rank.",
  },
  {
    question: "How long does a product stay visible?",
    answer: "Every accepted product stays visible for the full season. Products are not removed for falling behind, so every entrant keeps the same opportunity to be discovered.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <article className="shell section">
      <div className="max-w-2xl">
        <p className="eyebrow">How it works</p>
        <h1 className="text-title mt-3 font-semibold">Launch your SaaS with season-long visibility.</h1>
        <p className="text-subtle text-lead mt-3">
          Submit your SaaS, AI tool, startup, or developer product for a season of discovery. All {FIELD_SIZE} spots launch together, rankings follow verified visitor clicks, and every listing stays live for the full season.
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

      <section className="border-border mt-14 border-t pt-10" aria-labelledby="faq-title">
        <p className="eyebrow">Frequently asked questions</p>
        <h2 id="faq-title" className="text-title mt-3 font-semibold">Launching a product on Surviver.lol</h2>
        <div className="mt-7 grid gap-6 md:grid-cols-2">
          {FAQS.map(({ question, answer }) => (
            <div key={question}>
              <h3 className="font-semibold">{question}</h3>
              <p className="text-subtle mt-2 text-sm leading-relaxed">{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
