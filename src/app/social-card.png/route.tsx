import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siDiscord, siYoutube } from "simple-icons";
import { FIELD_SIZE } from "@/lib/competition/constants";

/**
 * The link preview shown when surviver.lol is shared on X, LinkedIn, Slack…
 *
 * It sells the format as it actually is: a fixed field of 32, every product
 * live for the whole season, ranked by real clicks. No "one survives" — a
 * founder deciding whether to pay should not read that 31 of them lose.
 *
 * Built once at build time (force-static), from code rather than a PNG in
 * /public, so the number on the card comes from the same FIELD_SIZE the
 * database enforces and cannot drift from the product again.
 */
export const dynamic = "force-static";

const font = (weight: number) =>
  readFile(join(process.cwd(), "node_modules/@fontsource/dm-sans/files", `dm-sans-latin-${weight}-normal.woff`));

const INK = "#1f1d1b";
const SUBTLE = "#5f5a55";
const BLUE = "#3b76e1";
const GROUND = "#fffdfa";

// Four abstract board rows: podium tile, a category-coloured logo block, and a
// click bar. Deliberately no product names or figures — this is a picture of
// the format, not a claim about real entrants.
const ROWS = [
  { rank: "01", tile: ["#fff4d6", "#b7791f"], logo: ["#e4edfb", "#375688"], bar: 0.92, rising: false },
  { rank: "02", tile: ["#eef1f5", "#55607a"], logo: ["#ddefeb", "#2c6055"], bar: 0.74, rising: true },
  { rank: "03", tile: ["#fdeee4", "#a4532b"], logo: ["#eeeafb", "#544a8c"], bar: 0.58, rising: false },
  { rank: "04", tile: ["#f4f1ec", "#67625d"], logo: ["#fbe8df", "#9a4c31"], bar: 0.41, rising: false },
];

export async function GET() {
  const [medium, bold, heavy] = await Promise.all([font(500), font(700), font(800)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: GROUND,
          backgroundImage: `radial-gradient(circle at 88% 18%, rgba(59,118,225,0.16), transparent 42%), radial-gradient(circle at 8% 100%, rgba(224,96,63,0.10), transparent 40%)`,
          fontFamily: "DM Sans",
          color: INK,
          padding: "56px 64px",
        }}
      >
        {/* Left: the claim */}
        <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 5, width: 48, height: 48, borderRadius: 13, background: BLUE, paddingBottom: 11 }}>
              <div style={{ width: 7, height: 12, borderRadius: 3, background: "#ffb49c" }} />
              <div style={{ width: 7, height: 26, borderRadius: 3, background: "#ffffff" }} />
              <div style={{ width: 7, height: 12, borderRadius: 3, background: "#ffb49c" }} />
            </div>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
              surviver<span style={{ color: BLUE }}>.lol</span>
            </div>
          </div>

          <div style={{ display: "flex", marginTop: 52, alignSelf: "flex-start", alignItems: "center", gap: 10, padding: "9px 18px", borderRadius: 999, background: "#edf3fe", color: BLUE, fontSize: 22, fontWeight: 700 }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: "#009f31" }} />
            Spots open now
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 22, fontSize: 70, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2.4 }}>
            <span>{FIELD_SIZE} SaaS spots.</span>
            <span style={{ color: BLUE }}>Ranked by clicks.</span>
          </div>

          <div style={{ display: "flex", marginTop: 22, fontSize: 28, fontWeight: 500, color: SUBTLE, lineHeight: 1.35 }}>
            Every product stays live all season. Real visitors decide the rank.
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: "auto" }}>
            {["$29 flat", "Live all season"].map((label) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 14, border: "2px solid #e6e0da", background: "#ffffff", fontSize: 22, fontWeight: 700 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {label}
              </div>
            ))}
            {/* The extra reach, said with the two marks in their own colours. */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRadius: 14, border: "2px solid #e6e0da", background: "#ffffff", fontSize: 22, fontWeight: 700 }}>
              Featured on
              <svg width="26" height="26" viewBox="0 0 24 24"><path d={siYoutube.path} fill={`#${siYoutube.hex}`} /></svg>
              <svg width="26" height="26" viewBox="0 0 24 24"><path d={siDiscord.path} fill={`#${siDiscord.hex}`} /></svg>
            </div>
          </div>
        </div>

        {/* Right: the board */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 432,
              padding: 22,
              gap: 12,
              borderRadius: 28,
              background: "#ffffff",
              border: "2px solid #ece6df",
              boxShadow: "0 30px 70px -25px rgba(31,29,27,0.28)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 4px 6px" }}>
              <span style={{ fontSize: 22, fontWeight: 800 }}>Live ranking</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700, color: "#009f31" }}>
                <div style={{ width: 9, height: 9, borderRadius: 999, background: "#009f31" }} />
                LIVE
              </span>
            </div>
            {ROWS.map((row) => (
              <div key={row.rank} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 18, background: row.rank === "01" ? "#fffaf0" : "#faf8f5", border: row.rank === "01" ? "2px solid #f3d38b" : "2px solid transparent" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 11, background: row.tile[0], color: row.tile[1], fontSize: 18, fontWeight: 800 }}>
                  {row.rank}
                </div>
                <div style={{ display: "flex", width: 44, height: 44, borderRadius: 12, background: row.logo[0], alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 6, background: row.logo[1] }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 9 }}>
                  <div style={{ display: "flex", width: 150, height: 12, borderRadius: 6, background: "#2a2724", opacity: 0.85 }} />
                  <div style={{ display: "flex", height: 10, borderRadius: 5, background: "#ece7e1" }}>
                    <div style={{ width: `${row.bar * 100}%`, height: 10, borderRadius: 5, background: BLUE }} />
                  </div>
                </div>
                {row.rising ? (
                  <div style={{ display: "flex", padding: "7px 9px", borderRadius: 999, background: "#e3f5e8" }}>
                    <svg width="14" height="12" viewBox="0 0 14 12"><path d="M7 0L14 12H0z" fill="#00852a" /></svg>
                  </div>
                ) : null}
              </div>
            ))}
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
