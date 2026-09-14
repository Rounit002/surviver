import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageMetadata, publicPages } from "@/lib/seo";

export const metadata = pageMetadata("/sitemap");
export const dynamic = "force-dynamic";

export default async function SitemapPage() {
  const seasons = await prisma.season.findMany({ select: { number: true, name: true }, orderBy: { number: "desc" } });
  return <article className="mx-auto w-full max-w-3xl px-4 py-12">
    <h1 className="text-3xl font-semibold">Site map</h1>
    <p className="text-subtle mt-3">Explore the tournament, discover products, and browse results.</p>
    <h2 className="mt-8 text-xl font-semibold">Explore Surviver.lol</h2>
    <ul className="mt-4 space-y-3">{publicPages.filter(page => page.path !== "/sitemap").map(page => <li key={page.path}>
      <Link className="text-primary inline-flex min-h-11 items-center underline" href={page.path}>{page.title}</Link>
      <p className="text-subtle text-sm">{page.description}</p>
    </li>)}</ul>
    <h2 className="mt-8 text-xl font-semibold">Season archive</h2>
    <ul className="mt-3">{seasons.map(season => <li key={season.number}><Link className="text-primary inline-flex min-h-11 items-center underline" href={`/seasons/${season.number}`}>{season.name}</Link></li>)}</ul>
  </article>;
}
