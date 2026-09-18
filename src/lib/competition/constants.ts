import type { CompetitiveStatus, EntryStatus, ProductCategory, SeasonStatus } from "@/generated/prisma";

/**
 * The categories Season 0 accepts. Deliberately narrow: Surviver's early
 * audience overlaps startup and technology communities, so products whose
 * buyers live elsewhere would pay for exposure that cannot convert (PRD 3).
 */
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  AI: "AI",
  DEV_TOOLS: "Developer Tools",
  PRODUCTIVITY: "Productivity",
  MARKETING: "Marketing",
  DESIGN: "Design",
  FOUNDER_TOOLS: "Founder Tools",
  AUTOMATION: "Automation",
  NO_CODE: "No-Code",
  ANALYTICS: "Analytics",
  CREATOR: "Creator Tools",
};

export const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS) as ProductCategory[];

/**
 * A pastel per category.
 *
 * Colour here is identity, not decoration: ten categories rendered in one grey
 * make a board of 32 cards unscannable. The tints are desaturated and warm so
 * they sit on the paper ground without competing with the deep green brand or
 * with the reds that mean elimination. Ink is always dark enough to read at
 * 12px on its own tint.
 *
 * Values are data rather than design tokens, so they are applied inline; there
 * is no Tailwind class to generate for a colour chosen at runtime.
 */
/**
 * The per-category tint/ink pair, as `var()` references rather than hex.
 *
 * These are handed straight to JSX inline styles, and an inline style is the
 * one place a stylesheet cannot reach — so as literals they stayed pastel when
 * the page went dark, ten bright blocks on near-black. Pointing at variables
 * lets the same style resolve per theme. The colours themselves, light and
 * dark, are in `globals.css` next to the rest of the palette.
 */
export const CATEGORY_COLORS: Record<ProductCategory, { tint: string; ink: string }> = {
  AI: { tint: "var(--cat-ai-tint)", ink: "var(--cat-ai-ink)" },
  DEV_TOOLS: { tint: "var(--cat-dev-tools-tint)", ink: "var(--cat-dev-tools-ink)" },
  PRODUCTIVITY: { tint: "var(--cat-productivity-tint)", ink: "var(--cat-productivity-ink)" },
  MARKETING: { tint: "var(--cat-marketing-tint)", ink: "var(--cat-marketing-ink)" },
  DESIGN: { tint: "var(--cat-design-tint)", ink: "var(--cat-design-ink)" },
  FOUNDER_TOOLS: { tint: "var(--cat-founder-tools-tint)", ink: "var(--cat-founder-tools-ink)" },
  AUTOMATION: { tint: "var(--cat-automation-tint)", ink: "var(--cat-automation-ink)" },
  NO_CODE: { tint: "var(--cat-no-code-tint)", ink: "var(--cat-no-code-ink)" },
  ANALYTICS: { tint: "var(--cat-analytics-tint)", ink: "var(--cat-analytics-ink)" },
  CREATOR: { tint: "var(--cat-creator-tint)", ink: "var(--cat-creator-ink)" },
};

type StatusPresentation = {
  label: string;
  /** Tailwind text colour token. */
  tone: string;
  /** Tailwind background + border pair for chips. */
  chip: string;
  description: string;
};

export const COMPETITIVE_STATUS: Record<CompetitiveStatus, StatusPresentation> = {
  COLLECTING_DATA: {
    label: "Collecting Data",
    tone: "text-subtle",
    chip: "bg-muted border-border text-subtle",
    description: "Not enough qualified views yet for a stable rank.",
  },
  SAFE: {
    label: "Safe",
    tone: "text-safe",
    chip: "bg-safe/8 border-safe/25 text-safe",
    description: "Currently above the elimination line.",
  },
  RISING: {
    label: "Rising",
    tone: "text-safe",
    chip: "bg-safe/8 border-safe/25 text-safe",
    description: "Climbing the standings since the last snapshot.",
  },
  DANGER: {
    label: "Danger",
    tone: "text-rising",
    chip: "bg-rising/10 border-rising/30 text-rising",
    description: "Close to the elimination line.",
  },
  ELIMINATION_ZONE: {
    label: "Elimination Zone",
    tone: "text-danger",
    chip: "bg-danger/10 border-danger/35 text-danger",
    description: "Would be eliminated if the round ended now.",
  },
  ELIMINATED: {
    label: "Eliminated",
    tone: "text-faint",
    chip: "bg-muted border-border text-faint",
    description: "Removed from this season.",
  },
  FINALIST: {
    label: "Finalist",
    tone: "text-gold",
    chip: "bg-gold/10 border-gold/35 text-gold",
    description: "One of the last two standing.",
  },
  SURVIVOR: {
    label: "Survivor",
    tone: "text-gold",
    chip: "bg-gold/15 border-gold/45 text-gold",
    description: "Season winner.",
  },
};

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  AWAITING_PAYMENT: "Awaiting Payment",
  AWAITING_APPROVAL: "Awaiting Approval",
  REJECTED: "Rejected",
  UPCOMING: "Upcoming",
  ACTIVE: "Competing",
  ELIMINATED: "Eliminated",
  FINALIST: "Finalist",
  SURVIVOR: "Survivor",
  DISQUALIFIED: "Disqualified",
  WITHDRAWN: "Withdrawn",
};

/**
 * Season 0 bracket. 32 enter, one survives (PRD 6). Stored on Round records at
 * season creation so later seasons can use a different shape without a deploy.
 */
export const DEFAULT_BRACKET = [
  { name: "Round 1", entrants: 32, eliminate: 8 },
  { name: "Round 2", entrants: 24, eliminate: 8 },
  { name: "Round 3", entrants: 16, eliminate: 8 },
  { name: "Quarterfinal", entrants: 8, eliminate: 4 },
  { name: "Semifinal", entrants: 4, eliminate: 2 },
  { name: "Final", entrants: 2, eliminate: 1 },
] as const;

/** Cookie names. Visitor id is long lived; session id is per browser session. */
export const VISITOR_COOKIE = "sv_vid";
export const SESSION_COOKIE = "sv_sid";
export const AUTH_COOKIE = "sv_auth";
export const RALLY_COOKIE = "sv_rally";
/// Proves this browser started a checkout, so paying needs no account.
export const PENDING_PAYMENT_COOKIE = "sv_pay";
/// Holds the private campaign capability while the founder is away at the
/// payment provider, so the capability never travels in a provider return URL.
export const CAMPAIGN_TOKEN_COOKIE = "sv_campaign";

/**
 * Which seasons the public site is allowed to show. A draft season is
 * unfinished planning and a cancelled one never happened; neither belongs on
 * the public listings or in the sitemap. Every public surface shares this one
 * predicate so the listings, the detail pages and the sitemap cannot drift.
 */
export const PUBLIC_SEASON_STATUSES: SeasonStatus[] = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "RUNNING", "COMPLETED"];

export const publicSeasonFilter = { status: { in: PUBLIC_SEASON_STATUSES } };

/** Postgres `Int` bounds: a larger value is a bad request, not a server error. */
export function parseSeasonNumber(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 2_147_483_647 ? parsed : null;
}
