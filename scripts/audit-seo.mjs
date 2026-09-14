// Read-only smoke audit of rendered public pages and their internal links.
import assert from "node:assert/strict";
const origin = process.argv[2] ?? "http://localhost:3100";
const sitemap = await fetch(`${origin}/sitemap.xml`);
assert.equal(sitemap.status, 200, "XML sitemap must load");
const xml = await sitemap.text();
const paths = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(match[1]).pathname);
assert(paths.length >= 11, "Sitemap must include public pages");
const links = new Set();
for (const path of paths) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${path}: exactly one H1`);
  assert.match(html, /<title>[^<]+<\/title>/, `${path}: title`);
  assert.match(html, /<meta name="description" content="[^"]+"/, `${path}: description`);
  assert.match(html, /<link rel="canonical" href="https:\/\/surviver\.lol[^\"]*"/, `${path}: canonical`);
  assert(!/<meta name="robots" content="[^"]*noindex/.test(html), `${path}: indexable`);
  assert.match(html, /name="google-site-verification"/, `${path}: verification`);
  assert.match(html, /property="og:image"/, `${path}: social image`);
  for (const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(match[1]);
  for (const match of html.matchAll(/<a\b[^>]*href="(\/[^"#]*)"/g)) {
    if (!/^\/(?:go|rally|api|entry|admin)(?:\/|$)/.test(match[1])) links.add(match[1].replaceAll('&amp;', '&'));
  }
  console.log(`PASS ${path}`);
}
for (const path of links) {
  const response = await fetch(`${origin}${path}`);
  assert(response.status < 400, `Broken internal link ${path}: ${response.status}`);
}
const robots = await fetch(`${origin}/robots.txt`);
assert.equal(robots.status, 200);
assert.match(await robots.text(), /Sitemap: https:\/\/surviver.lol\/sitemap.xml/);
assert.equal(robots.headers.get('set-cookie'), null, 'robots.txt must not create visitor sessions');
console.log(`Verified ${paths.length} public pages and ${links.size} internal links.`);
