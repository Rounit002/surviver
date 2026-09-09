import type { CompetitiveStatus, EntryStatus, ProductCategory } from "@/generated/prisma";

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
export const CATEGORY_COLORS: Record<ProductCategory, { tint: string; ink: string }> = {
  AI: { tint: "#E9E4F7", ink: "#544A8C" },
  DEV_TOOLS: { tint: "#DCE7F7", ink: "#375688" },
  PRODUCTIVITY: { tint: "#D7EAE6", ink: "#2C6055" },
  MARKETING: { tint: "#F9E1D7", ink: "#9A4C31" },
  DESIGN: { tint: "#F7DEEA", ink: "#8E4267" },
  FOUNDER_TOOLS: { tint: "#F6E7C9", ink: "#84611E" },
  AUTOMATION: { tint: "#E1E5EF", ink: "#434D6E" },
  NO_CODE: { tint: "#E5EFD6", ink: "#51652A" },
  ANALYTICS: { tint: "#D6EAF0", ink: "#2A5F71" },
  CREATOR: { tint: "#F6DFE0", ink: "#914248" },
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
