## Dubai Schools Explorer (POC)

A demo site for exploring and reviewing schools in Dubai.

### Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

### What's in this POC

- **Home (`/`)** — search and filter all 232 schools by curriculum, area, KHDA rating, and max fee, with sorting.
- **School detail (`/schools/[slug]`)** — curriculum, fees, KHDA rating, location map, official website link, and parent reviews (leave-a-review form).
- **Parent Journal (`/journal`)** — a shared board where parents/residents post reviews, questions, or quotation requests, searchable by keyword.
- **Assistant** — floating icon (bottom-right on every page) opens a chat panel. Answers stream in from Claude, grounded in the school data below.

### Data

School data lives in [`src/data/schools.json`](src/data/schools.json) — **all 232 private schools** in KHDA's public education directory, with curriculum, area, grade range, KHDA inspection rating and published annual fee range.

It is generated, not hand-maintained:

```bash
npm run seed:schools
```

See [`scripts/seed-data/README.md`](scripts/seed-data/README.md) for how the ingest works, the TLS quirk it works around, and what to check if KHDA changes their markup. KHDA has no public API and the Dubai Pulse open-data CSVs no longer resolve after that portal's migration, so the ingest parses the directory's server-rendered HTML and needs a periodic re-run rather than being a live feed.

Coverage at the last refresh: 232 schools, 206 with a published fee range, 210 with an inspection rating, 209 with a website. Figures are KHDA's own and should still be confirmed with the school before any decision.

Reviews and journal posts are stored in the browser's `localStorage` (no backend/database yet) — fine for a demo, but posts won't be shared across devices/browsers.

### The assistant

Set one environment variable and the chat panel works:

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

Without it the panel replies "The assistant isn't configured yet" rather than failing — safe to deploy before the key is set. On Vercel, add it under Project → Settings → Environment Variables.

How it works:

- [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts) calls Claude and **streams** the reply back as plain text, so answers appear as they are written.
- [`src/lib/systemPrompt.ts`](src/lib/systemPrompt.ts) holds the assistant's instructions — scope, tone, and the rules against inventing fees or ratings.
- [`src/lib/schoolContext.ts`](src/lib/schoolContext.ts) renders all 232 schools as a compact table (~8K tokens) appended to the system prompt. Every answer is therefore grounded in the real listing with no vector store or retrieval step. The prompt is static, so it is marked cacheable and repeat requests read it at a fraction of the cost.
- The last 10 turns are sent with each request, so the assistant can follow a conversation.

**Before a public launch:** this endpoint calls a paid API and has no rate limiting. Input length and history depth are capped, but nothing stops repeated requests from one visitor. Put a rate limiter in front of it.
