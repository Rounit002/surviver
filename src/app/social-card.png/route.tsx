import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siDiscord, siYoutube } from "simple-icons";
import { STREAM_STATS } from "@/components/ui/BrandIcon";
import { getSubscriberCount } from "@/lib/youtube";
import { FIELD_SIZE } from "@/lib/competition/constants";

/**
 * The link preview shown when surviver.lol is shared on X, LinkedIn, Slack…
 *
 * It sells the format as it actually is: a fixed field of 32, every product
 * live for the whole season, ranked by real clicks — and, since the October
 * refresh, shown on the YouTube live stream. It mirrors the home hero: the
 * claim on the left, the stream player holding the podium on the right, and
 * the channel's real numbers under it. No "one survives" — a founder deciding
 * whether to pay should not read that 31 of them lose.
 *
 * X no longer prints the page title under a large card, only the image with
 * the domain laid over its bottom-left corner, so the card has to carry the
 * whole message itself and keeps that corner empty.
 *
 * Flat fills and neutral layered shadows only: no gradients, no glows.
 *
 * Built at build time and refreshed daily (so the subscriber count follows the
 * channel), from code rather than a PNG in
 * /public, so the numbers on the card come from the same FIELD_SIZE and
 * STREAM_STATS the site uses and cannot drift from the product again. When
 * the card changes, bump `SOCIAL_CARD_VERSION` in `lib/seo.ts` so X and
 * LinkedIn fetch it afresh instead of serving their cached copy.
 */
export const revalidate = 86400;

const font = (weight: number) =>
  readFile(join(process.cwd(), "node_modules/@fontsource/dm-sans/files", `dm-sans-latin-${weight}-normal.woff`));

const INK = "#1f1d1b";
const SUBTLE = "#5f5a55";
const BLUE = "#3b76e1";
const CORAL = "#e0603f";
const CORAL_SOFT = "#fdeee8";
const GROUND = "#fffdfa";
const HAIRLINE = "#ece6df";
const STAGE = "#1f1d1b";
const YT_RED = "#ff0033";
const SHADOW = "0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 4px rgba(31,29,27,0.06), 0 14px 28px -10px rgba(31,29,27,0.18), 0 36px 64px -28px rgba(31,29,27,0.26)";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const [, monthlyViews] = STREAM_STATS;

// The podium inside the stream, drawn like the hero's: the logo's three bars,
// tall in the middle. Abstract marks only — this is a picture of the format,
// not a claim about real entrants.
const PODIUM = [
  { rank: 2, height: 78, step: CORAL, ink: "#ffffff", mark: ["#ddefeb", "#2c6055"] },
  { rank: 1, height: 118, step: BLUE, ink: "#ffffff", mark: ["#e4edfb", "#375688"] },
  { rank: 3, height: 52, step: CORAL_SOFT, ink: CORAL, mark: ["#fbe8df", "#9a4c31"] },
];

// The side rails the stream flips through: the rest of the lineup, as pastel
// tiles. One per rail is "on screen", edged in white.
const RAILS = [
  [["#fff4d6", "#b7791f"], ["#eef1f5", "#55607a"], ["#e3f5e8", "#2d7a45"]],
  [["#eeeafb", "#544a8c"], ["#fdeee4", "#a4532b"], ["#e4edfb", "#375688"]],
];

function Tick({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Mark({ size, colors }: { size: number; colors: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size * 0.28, background: colors[0] }}>
      <div style={{ width: size * 0.4, height: size * 0.4, borderRadius: size * 0.13, background: colors[1] }} />
    </div>
  );
}

function Rail({ tiles, on }: { tiles: string[][]; on: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {tiles.map((colors, i) => (
        <div key={i} style={{ display: "flex", padding: 3, borderRadius: 13, border: i === on ? "2px solid #ffffff" : "2px solid transparent", opacity: i === on ? 1 : 0.55 }}>
          <Mark size={38} colors={colors} />
        </div>
      ))}
    </div>
  );
}

export async function GET() {
  const [medium, bold, heavy, subscriberCount] = await Promise.all([font(500), font(700), font(800), getSubscriberCount()]);
  const subscribers = { label: "Subscribers", value: subscriberCount };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: GROUND,
          fontFamily: "DM Sans",
          color: INK,
          padding: "0 60px 0 64px",
        }}
      >
        {/* Left: the claim */}
        <div style={{ display: "flex", flexDirection: "column", width: 560, marginTop: -24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 5, width: 46, height: 46, borderRadius: 13, background: BLUE, paddingBottom: 11 }}>
              <div style={{ width: 7, height: 12, borderRadius: 3, background: "#ffb49c" }} />
              <div style={{ width: 7, height: 24, borderRadius: 3, background: "#ffffff" }} />
              <div style={{ width: 7, height: 12, borderRadius: 3, background: "#ffb49c" }} />
            </div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
              surviver<span style={{ color: BLUE }}>.lol</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8, padding: "7px 14px", borderRadius: 999, background: "#edf3fe", color: BLUE, fontSize: 18, fontWeight: 700 }}>
              <div style={{ width: 9, height: 9, borderRadius: 999, background: "#009f31" }} />
              Spots open now
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, fontSize: 70, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2.4 }}>
            <span>{FIELD_SIZE} SaaS spots.</span>
            <span style={{ color: BLUE }}>Ranked by clicks.</span>
          </div>

          <div style={{ display: "flex", marginTop: 22, fontSize: 27, fontWeight: 500, color: SUBTLE, lineHeight: 1.38 }}>
            Every product stays live all season and gets shown on YouTube Live.
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 30 }}>
            {[
              { label: "$29 flat", tint: "#e4edfb", ink: BLUE },
              { label: "No bidding", tint: "#eeeafb", ink: "#544a8c" },
              { label: "Live every season", tint: "#ddefeb", ink: "#2c6055" },
            ].map(({ label, tint, ink }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 12, background: tint, color: INK, fontSize: 21, fontWeight: 700 }}>
                <Tick color={ink} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Right: the live stream, holding the podium, with the channel's numbers under it */}
        <div style={{ display: "flex", flexDirection: "column", width: 486, gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", padding: 12, borderRadius: 24, background: "#ffffff", border: `2px solid ${HAIRLINE}`, boxShadow: SHADOW }}>
            {/* Window bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 4px 12px" }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                <div key={c} style={{ width: 11, height: 11, borderRadius: 999, background: c }} />
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 12, padding: "5px 12px", borderRadius: 8, background: "#f4f1ec", color: SUBTLE, fontSize: 15, fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path d={siYoutube.path} fill={`#${siYoutube.hex}`} /></svg>
                youtube.com/@rounieee/live
              </div>
            </div>

            {/* Video */}
            <div style={{ display: "flex", flexDirection: "column", height: 290, borderRadius: 16, background: STAGE, padding: "14px 18px 0", color: "#ffffff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 9px", borderRadius: 6, background: YT_RED, fontSize: 14, fontWeight: 800, letterSpacing: 0.6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 999, background: "#ffffff" }} />
                  LIVE
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, opacity: 0.9 }}>Surviver.lol Live — the season lineup</span>
              </div>

              <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignSelf: "center" }}>
                  <Rail tiles={RAILS[0]} on={1} />
                </div>

                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  {PODIUM.map((p) => (
                    <div key={p.rank} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 84 }}>
                      {p.rank === 1 ? (
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="#f2b632" stroke="#f2b632" strokeWidth="1.5" strokeLinejoin="round" style={{ marginBottom: 4 }}>
                          <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                        </svg>
                      ) : null}
                      <div style={{ display: "flex", padding: 4, borderRadius: 15, background: "#ffffff", boxShadow: "0 6px 14px -6px rgba(0,0,0,0.5)" }}>
                        <Mark size={p.rank === 1 ? 50 : 42} colors={p.mark} />
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", width: "100%", height: p.height, marginTop: 10, paddingTop: 8, borderRadius: "12px 12px 0 0", background: p.step, color: p.ink, fontSize: 26, fontWeight: 800 }}>
                        {p.rank}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", alignSelf: "center" }}>
                  <Rail tiles={RAILS[1]} on={2} />
                </div>
              </div>
            </div>

            {/* Player controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "11px 6px 2px" }}>
              <div style={{ display: "flex", height: 5, borderRadius: 3, background: "#ece7e1" }}>
                <div style={{ width: "100%", height: 5, borderRadius: 3, background: YT_RED }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, color: INK }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill={INK} /></svg>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, letterSpacing: 0.4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: YT_RED }} />
                  LIVE
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: SUBTLE }}>Every listed product, on screen</span>
              </div>
            </div>
          </div>

          {/* The channel's real numbers, and the Discord shout-out */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 18px", borderRadius: 18, background: "#ffffff", border: `2px solid ${HAIRLINE}` }}>
            {[subscribers, monthlyViews].map((stat) => (
              <div key={stat.label} style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <span style={{ fontSize: 24, fontWeight: 800 }}>{compact.format(stat.value)}</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: SUBTLE }}>{stat.label === "Subscribers" ? "subscribers" : "monthly views"}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", fontSize: 16, fontWeight: 700 }}>
              <svg width="24" height="24" viewBox="0 0 24 24"><path d={siDiscord.path} fill={`#${siDiscord.hex}`} /></svg>
              Shout-out
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "DM Sans", data: medium, weight: 500, style: "normal" },
        { name: "DM Sans", data: bold, weight: 700, style: "normal" },
        { name: "DM Sans", data: heavy, weight: 800, style: "normal" },
      ],
    },
  );
}
