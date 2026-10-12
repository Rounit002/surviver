import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { sitemapPages, SITE_URL } from "@/lib/seo";
import { publicSeasonFilter } from "@/lib/competition/season";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seasons = await prisma.season.findMany({ where: publicSeasonFilter, select: { number: true }, orderBy: { number: "desc" } });
  return [
    ...sitemapPages.map(({ path }) => ({
      url: `${SITE_URL}${path === "/" ? "" : path}`,
      changeFrequency: (["/", "/board", "/leaderboard"] as string[]).includes(path) ? "daily" as const : "monthly" as const,
      priority: path === "/" ? 1 : (["/board", "/leaderboard", "/how-it-works"] as string[]).includes(path) ? 0.8 : 0.5,
    })),
    ...seasons.map(({ number }) => ({
      url: `${SITE_URL}/seasons/${number}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
