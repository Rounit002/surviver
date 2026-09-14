# Surviver.lol search growth plan

## Technical foundation

Public pages have individual titles, descriptions and HTTPS canonical URLs. The HTML site map at `/sitemap` links to public pages and all season archives; `/sitemap.xml` uses the same canonical origin and real season records. No artificial last-modified dates are submitted. `robots.txt` points to the XML sitemap. Secret campaign links retain their existing noindex protection. Public pages had no noindex block before this work.

The WebSite JSON-LD describes the actual site. It makes no unsupported rating, award, review, or rich-result claims. The existing 1200 × 630 social image is compressed. Remote product logos have descriptive alternatives, explicit dimensions, lazy loading and asynchronous decoding; arbitrary third-party images are not given unrestricted access to a server-side image proxy.

Run `node scripts/audit-seo.mjs https://surviver.lol` after deployment. It checks sitemap coverage, HTTP responses, one H1 per public page, metadata, structured-data parsing and public internal links. It deliberately avoids scoring redirect links and state-changing routes.

## Performance constraint

Render's dashboard reports that the Free service sleeps with inactivity and that waking can delay requests by 50 seconds or more. An always-on hosting instance is the main next infrastructure improvement; this requires a paid plan decision. Do not claim a Core Web Vitals pass from a successful build or a single lab run. Monitor real-user LCP, INP and CLS through Search Console when enough traffic exists.

## Earn relevant backlinks

1. Publish a useful recap for each completed season: entrant categories, the actual measured results, methodology, and lessons. Use aggregate public data only. Link recaps to permanent season URLs and rules.
2. Give participating founders an optional plain-text link to their public season results, suitable for their own launch update or changelog. Do not require a backlink for entry, better ranking or exposure, and never share private campaign URLs.
3. Prepare a concise pitch for SaaS and indie-maker newsletters: explain the tournament, disclose the entry fee, provide real results and point to the scoring method. Contact only a few closely relevant editors with individually tailored messages. Outreach has not been sent as part of this task.
4. Share genuinely useful lessons in communities where the owner participates and promotion is permitted. Answer questions and disclose the relationship. Avoid repetitive directory submissions, purchased links, link exchanges and automated posting.
5. When there is a real newsworthy result, publish an original case study with the participating founder's permission. Offer a reusable chart or factual quote that editors can cite naturally.

## First 30 days

- Week 1: verify Search Console, submit `/sitemap.xml`, inspect the homepage and important public URLs, and record the indexing baseline.
- Week 2: publish the first substantive explanation or real season recap; prepare a list of 10 relevant newsletters or communities and note their submission rules.
- Week 3: draft 3–5 tailored pitches with a concrete reason the results help their readers. Obtain authorization before sending outreach messages.
- Week 4: compare indexed pages, search impressions, clicks and referring domains against the baseline. Improve the pages attracting relevant impressions and investigate crawl failures.

Sources: [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [Search Console setup](https://developers.google.com/search/docs/monitor-debug/search-console-start), [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies#link-spam).

Indexing and rankings are Google's decisions; a sitemap and verification improve discovery and diagnosis but do not guarantee inclusion.
