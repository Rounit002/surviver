import type { Metadata } from "next";

export const SITE_URL = "https://surviver.lol";
export const publicPages = [
  { path: "/", title: "Discover SaaS products in a live tournament", description: "Discover emerging SaaS products on Surviver.lol. Explore the discovery board, follow live standings, and see which product survives each season." },
  { path: "/board", title: "SaaS discovery board", description: "Explore SaaS products competing this season, from AI and developer tools to design and productivity. Visit the products that catch your interest." },
  { path: "/leaderboard", title: "Live SaaS tournament leaderboard", description: "Follow the live Surviver.lol standings, compare measured visitor interest, and see which SaaS products advance through each round." },
  { path: "/seasons", title: "Tournament seasons and results", description: "Browse Surviver.lol seasons, discover past lineups, and explore permanent tournament standings and results." },
  { path: "/survivors", title: "Hall of Survivors", description: "Discover the SaaS products that outlasted their season. Explore Surviver.lol tournament winners and their earned results." },
  { path: "/enter", title: "Enter your SaaS product", description: "Submit your SaaS product to a Surviver.lol season. Choose a category, review entry details, and compete for discovery through measured visitor interest." },
  { path: "/how-it-works", title: "How the SaaS tournament works", description: "Learn how Surviver.lol balances product exposure, measures qualified views and visits, and uses interest rates to decide who advances." },
  { path: "/rules", title: "Competition rules", description: "Read the Surviver.lol rules for entries, qualified views, scoring, elimination rounds, Rally referrals, and season survivors." },
  { path: "/privacy", title: "Privacy Policy", description: "Learn how Surviver.lol handles campaign information, payments, analytics, essential cookies, and requests concerning personal information." },
  { path: "/terms", title: "Terms of Service", description: "Review Surviver.lol terms for product submissions, promotional placements, moderation, entry fees, rankings, and refunds." },
  { path: "/sitemap", title: "Site map", description: "Find every public Surviver.lol page, including the discovery board, leaderboard, season archives, competition rules, and entry information." },
] as const;

export function pageMetadata(path: string, title?: string, description?: string): Metadata {
  const page = publicPages.find((page) => page.path === path);
  const resolvedTitle = title ?? page?.title;
  const resolvedDescription = description ?? page?.description;
  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: { canonical: `${SITE_URL}${path === "/" ? "" : path}` },
    openGraph: {
      title: resolvedTitle, description: resolvedDescription, url: `${SITE_URL}${path}`,
      siteName: "Surviver.lol", type: "website",
      images: [{ url: "/social-preview.png", width: 1200, height: 630, alt: "Surviver.lol — a tournament for SaaS products" }],
    },
    twitter: { card: "summary_large_image", title: resolvedTitle, description: resolvedDescription, images: ["/social-preview.png"] },
  };
}
