import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Rasterises the brand mark in `src/app/icon.svg` into the two formats the SVG
 * cannot cover: a legacy `favicon.ico` and the opaque `apple-icon.png` iOS
 * wants for the home screen. Re-run with `npm run icons` after editing the SVG.
 */

const appDir = path.join(process.cwd(), "src", "app");
const source = await readFile(path.join(appDir, "icon.svg"), "utf8");

// Render from a high density so the small sizes come off the vector rather
// than a downscale of one bitmap.
const render = (svg, size) =>
  sharp(Buffer.from(svg), { density: 900 }).resize(size, size).png().toBuffer();

/** Packs PNG frames into an .ico container (PNG-in-ICO, supported since IE11). */
function buildIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);

  let offset = 6 + frames.length * 16;
  const directory = frames.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 encodes 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...directory, ...frames.map((f) => f.data)]);
}

const icoSizes = [16, 32, 48];
const frames = await Promise.all(
  icoSizes.map(async (size) => ({ size, data: await render(source, size) })),
);
await writeFile(path.join(appDir, "favicon.ico"), buildIco(frames));

// iOS masks the icon itself and shows no transparency, so the home-screen
// version drops our corner radius and renders full bleed on the tile colour.
const appleSvg = source.replace(/\srx="7"/, "");
await writeFile(
  path.join(appDir, "apple-icon.png"),
  await sharp(await render(appleSvg, 180)).flatten({ background: "#2f52c8" }).png().toBuffer(),
);

console.log(`Wrote favicon.ico (${icoSizes.join(", ")}px) and apple-icon.png (180px).`);
