/**
 * Fetches the morning's candidate headlines and prints them as JSON.
 *
 *   node scripts/fetch-news.mjs > items.json
 *
 * WHY THIS RUNS HERE AND NOT IN THE WORKER
 * ----------------------------------------
 * It did run in the Worker, and Google answered every request with 503. Google
 * News refuses Cloudflare's egress the way Anthropic refuses it — the same
 * class of block, and not one that retrying solves. The GitHub runner has an
 * egress Google will talk to, so the fetch happens there and the Worker
 * receives the result.
 *
 * That split is also the better shape: this half needs no secrets and touches
 * no database, so it can be run by hand to see what the scan would find.
 */
const QUERIES = [
  "KHDA when:2d",
  "Dubai schools when:2d",
  "Dubai school fees when:2d",
  "Dubai private school inspection when:2d",
  "Dubai school term dates when:2d",
];

const MAX_PER_QUERY = 25;

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function fetchFeed(query) {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=en-AE&gl=AE&ceid=AE:en";

  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; dubai-schools/1.0; +https://dubai-schools.can-du-ai.com)",
    },
  });
  if (!res.ok) {
    console.error(`feed ${query}: HTTP ${res.status}`);
    return [];
  }

  const xml = await res.text();
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const rawTitle = decode((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] ?? "");
    const link = decode((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] ?? "");
    const source = decode((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] ?? "");
    const published = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] ?? "";
    if (!rawTitle || !link) continue;
    out.push({
      // Google appends " - Source" to every headline and also gives it in
      // <source>, so carrying both would print the outlet twice.
      headline:
        source && rawTitle.endsWith(` - ${source}`)
          ? rawTitle.slice(0, -(source.length + 3))
          : rawTitle,
      url: link,
      source,
      published,
    });
    if (out.length >= MAX_PER_QUERY) break;
  }
  return out;
}

const seen = new Set();
const items = [];
for (const q of QUERIES) {
  for (const c of await fetchFeed(q)) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    items.push(c);
  }
}

console.error(`fetched ${items.length} unique headlines across ${QUERIES.length} queries`);
process.stdout.write(JSON.stringify({ items }));
