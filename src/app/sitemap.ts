import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { sitemapPages, SITE_URL } from "@/lib/seo";
import { publicSeasonFilter } from "@/lib/competition/season";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seasons = await prisma.season.findMany({ where: publicSeasonFilter, select: { number: true, updatedAt: true }, orderBy: { number: "desc" } });
  const dynamicLastModified = seasons[0]?.updatedAt;
  return [
    ...sitemapPages.map(({ path }) => ({
      url: `${SITE_URL}${path === "/" ? "" : path}`,
      ...(dynamicLastModified && ["/", "/board", "/leaderboard", "/seasons", "/survivors"].includes(path)
        ? { lastModified: dynamicLastModified }
        : {}),
      changeFrequency: (["/", "/board", "/leaderboard"] as string[]).includes(path) ? "daily" as const : "monthly" as const,
      priority: path === "/" ? 1 : (["/board", "/leaderboard", "/how-it-works"] as string[]).includes(path) ? 0.8 : 0.5,
    })),
    ...seasons.map(({ number, updatedAt }) => ({
      url: `${SITE_URL}/seasons/${number}`,
      lastModified: updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
