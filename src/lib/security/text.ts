/**
 * Cleans text scraped from a founder's site before it is stored and shown on
 * the public board.
 *
 * React already escapes everything it renders, so this is not about script
 * injection. It is about text that is valid Unicode but hostile on a shared
 * board: right-to-left overrides that make "moc.elgoog" read as "google.com",
 * zero-width floods that blow up a flex row, control characters, and stray
 * markup left over from a `<title>`.
 */

// Bidi embeddings/overrides/isolates, zero-width and joiner characters, the
// word joiner family, the BOM, and soft hyphen.
const INVISIBLE = /[\u00AD\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g;
// C0 and C1 controls, except the whitespace that the collapse below handles.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const TAG = /<\/?[a-z][^>]*>/gi;

export function cleanText(value: string | null | undefined, maxLength: number): string {
  if (!value) return "";
  const cleaned = value
    .normalize("NFKC")
    .replace(TAG, " ")
    .replace(INVISIBLE, "")
    .replace(CONTROL, "")
    .replace(/\s+/g, " ")
    .trim();
  // Slice by code point so an emoji is never cut in half.
  return Array.from(cleaned).slice(0, maxLength).join("").trim();
}
