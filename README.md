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
- **Chatbot** — floating icon (bottom-right on every page) opens a chat panel. It currently returns a stubbed reply.

### Data

School data lives in [`src/data/schools.json`](src/data/schools.json) — **all 232 private schools** in KHDA's public education directory, with curriculum, area, grade range, KHDA inspection rating and published annual fee range.

It is generated, not hand-maintained:

```bash
npm run seed:schools
```

See [`scripts/seed-data/README.md`](scripts/seed-data/README.md) for how the ingest works, the TLS quirk it works around, and what to check if KHDA changes their markup. KHDA has no public API and the Dubai Pulse open-data CSVs no longer resolve after that portal's migration, so the ingest parses the directory's server-rendered HTML and needs a periodic re-run rather than being a live feed.

Coverage at the last refresh: 232 schools, 206 with a published fee range, 210 with an inspection rating, 209 with a website. Figures are KHDA's own and should still be confirmed with the school before any decision.

Reviews and journal posts are stored in the browser's `localStorage` (no backend/database yet) — fine for a demo, but posts won't be shared across devices/browsers.

### Wiring up the chatbot

The chat UI is in [`src/components/ChatWidget.tsx`](src/components/ChatWidget.tsx). Replace the `getBotReply` function with a real API call (e.g. to an `/api/chat` route that forwards to your chosen provider) once an API key is available.
