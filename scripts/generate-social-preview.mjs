import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Keep the sharing card in the site's flat lavender, blue, and coral palette.
// Run `node scripts/generate-social-preview.mjs` to regenerate the public PNG.
const mark = (await readFile(new URL("../src/app/icon.svg", import.meta.url), "utf8"))
  .replace('width="32" height="32"', 'x="64" y="54" width="56" height="56"');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f4f2f5"/>
  <rect x="0" y="0" width="1200" height="10" fill="#2f52c8"/>
  ${mark}
  <g font-family="Arial, sans-serif">
    <text x="136" y="94" font-size="34" font-weight="700" fill="#221d26">Surviver.lol</text>
    <text x="64" y="198" font-size="18" font-weight="700" letter-spacing="3" fill="#5d5566">THE SAAS SURVIVAL TOURNAMENT</text>
    <text x="60" y="286" font-size="68" font-weight="700" letter-spacing="-3" fill="#221d26">35 products enter.</text>
    <text x="60" y="369" font-size="68" font-weight="700" letter-spacing="-3" fill="#2f52c8">One survives.</text>
    <text x="64" y="434" font-size="25" fill="#5d5566">Equal exposure. Real interest. Earn your spot.</text>
    <line x1="64" y1="502" x2="1136" y2="502" stroke="#cfc9d4"/>
    <text x="64" y="559" font-size="21" fill="#221d26">Attention decides who advances.</text>
    <text x="1136" y="559" text-anchor="end" font-size="21" font-weight="700" fill="#2f52c8">surviver.lol</text>
  </g>
  <rect x="824" y="171" width="312" height="280" rx="24" fill="#e9edfa"/>
  <path d="M854 388H1106" stroke="#cfc9d4" stroke-width="2"/>
  <rect x="861" y="321" width="62" height="67" rx="8" fill="#e0603f"/>
  <rect x="949" y="222" width="62" height="166" rx="8" fill="#2f52c8"/>
  <rect x="1037" y="321" width="62" height="67" rx="8" fill="#e0603f"/>
  <circle cx="980" cy="197" r="15" fill="#221d26"/>
  <path d="m974 197 4 4 8-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL("../public/social-preview.png", import.meta.url)));
console.log("Generated public/social-preview.png (1200 × 630).");
