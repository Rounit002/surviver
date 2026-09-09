import Link from "next/link";
import { DEFAULT_BRACKET } from "@/lib/competition/constants";
export const metadata = { title: "How scoring works" };
export default function HowItWorksPage() {
  return <article className="mx-auto w-full max-w-2xl px-4 py-10"><p className="label">Behind the standings</p><h1 className="mt-3 text-3xl font-semibold">Curiosity is the score.</h1><p className="text-subtle mt-4 text-sm leading-7">The board favors underexposed products. Every visit that follows a qualified view updates a product’s Interest Rate — position cannot be bought.</p>
    <div className="bg-primary-soft my-8 rounded-3xl p-6"><p className="text-primary text-lg font-semibold">Interest Rate = verified visits ÷ qualified views</p><p className="text-subtle mt-3 text-sm leading-6">Example only, not live activity: 10 visits from 250 qualified views is 4%.</p></div>
    <h2 className="text-xl font-semibold">The standard 32-product bracket</h2><p className="text-subtle mt-3 text-sm leading-6">Smaller lineups use an adjusted bracket. Every round posts its elimination count and deadline.</p>
    <div className="border-border mt-5 overflow-hidden rounded-2xl border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="p-4">Round</th><th className="p-4 text-right">Enter</th><th className="p-4 text-right">Advance</th></tr></thead><tbody>{DEFAULT_BRACKET.map(r => <tr key={r.name} className="border-border border-t"><td className="p-4">{r.name}</td><td className="num p-4 text-right">{r.entrants}</td><td className="num text-primary p-4 text-right">{r.entrants-r.eliminate}</td></tr>)}</tbody></table></div>
    <p className="text-subtle mt-6 text-sm leading-7">No one is eliminated until every product meets the minimum sample. Due rounds close automatically, and completed scores stay frozen.</p><Link href="/rules" className="text-primary mt-5 inline-block text-sm font-semibold">Read all competition rules →</Link></article>;
}
