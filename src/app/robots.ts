import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Let crawlers read the noindex metadata on auth and dashboard pages.
      // Secret capability links, redirects, checkout and API routes remain blocked.
      disallow: ["/api/", "/entry/", "/enter/checkout/", "/go/", "/rally/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
