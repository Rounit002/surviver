import "server-only";
import { SOCIAL_LINKS, STREAM_STATS } from "@/components/ui/BrandIcon";

/** Refetch at most hourly; YouTube itself only moves the public figure in 3-digit steps. */
const REVALIDATE_SECONDS = 3600;
const HANDLE = new URL(SOCIAL_LINKS.youtube).pathname.replace(/^\/@/, "");
const FALLBACK = STREAM_STATS[0].value;

/**
 * The channel's live subscriber count.
 *
 * With `YOUTUBE_API_KEY` set it asks the YouTube Data API. Without one it
 * reads the public "8.05K subscribers" text from the channel's about page.
 * Either way the result is cached for an hour, and any failure falls back to
 * the last hand-checked figure in `STREAM_STATS`, so the page never breaks.
 */
export async function getSubscriberCount(): Promise<number> {
  try {
    const fromApi = process.env.YOUTUBE_API_KEY ? await fromDataApi(process.env.YOUTUBE_API_KEY) : null;
    return fromApi ?? (await fromChannelPage()) ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}

async function fromDataApi(key: string): Promise<number | null> {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${HANDLE}&key=${key}`;
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: { statistics?: { subscriberCount?: string } }[] };
  return sane(Number(data.items?.[0]?.statistics?.subscriberCount));
}

async function fromChannelPage(): Promise<number | null> {
  const res = await fetch(`${SOCIAL_LINKS.youtube}/about?hl=en&gl=US`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; surviver.lol)", "Accept-Language": "en-US,en;q=0.9" },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const match = (await res.text()).match(/"subscriberCountText":"([\d.,]+)\s*([KMB])?\s+subscribers"/);
  if (!match) return null;
  const scale = { K: 1e3, M: 1e6, B: 1e9 }[match[2] as "K" | "M" | "B"] ?? 1;
  return sane(Math.round(Number(match[1].replace(/,/g, "")) * scale));
}

/** Reject anything implausible (a parse slip, another channel's card) in favour of the fallback. */
function sane(n: number): number | null {
  return Number.isFinite(n) && n >= FALLBACK / 2 && n < FALLBACK * 100 ? n : null;
}
