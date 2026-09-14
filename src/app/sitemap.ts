import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { publicPages, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seasons = await prisma.season.findMany({ select: { number: true }, orderBy: { number: "desc" } });
  return [
    ...publicPages.map(({ path }) => ({ url: `${SITE_URL}${path === "/" ? "" : path}` })),
    ...seasons.map(({ number }) => ({ url: `${SITE_URL}/seasons/${number}` })),
  ];
}
