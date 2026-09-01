# School data ingest

Builds `src/data/schools.json` from KHDA's public education directory.

```bash
npm run seed:schools                    # full refresh (uses the local cache)
npm run seed:schools -- --refresh       # bypass the cache and re-fetch
npm run seed:schools -- --limit 10 --dry-run   # inspect output, write nothing
```

## Source

KHDA's education directory is server-rendered, so no browser automation is
needed:

| What | Where |
| --- | --- |
| Listing (all schools, one page) | `web.khda.gov.ae/en/Education-Directory/Schools` |
| Per-school detail | `.../Schools/School-Details?Id=<khdaId>&CenterID=<centerId>` |

The listing supplies name, area, curriculum, grade range, phone and KHDA's
internal ids. The detail page supplies the overall DSIB inspection rating, the
inspection year, the published fee range and the school website.

This replaced the Dubai Pulse open-data route: that portal migrated to
`data.dubai` and its dataset deep links — including the KHDA schools CSV — now
301-redirect to the homepage.

## Notes

- **TLS.** `web.khda.gov.ae` serves an incomplete certificate chain. Node's
  bundled CA list rejects it, so the npm script starts Node with
  `--use-system-ca`. Running `node scripts/seed-data/ingest.mts` directly will
  fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
- **Caching.** Every response is written to `.cache/` (gitignored), so re-runs
  cost zero requests. Use `--refresh` after KHDA publishes new inspections.
- **Politeness.** Concurrency 2 with a 500 ms gap and retry-with-backoff. This
  is a government site — do not raise these.
- **Curriculum normalisation.** KHDA publishes free text with ~31 spellings
  (`UK (13 Y)`, `UK*`, `US/IB`, `Ministry of Education \ BTEC`, comma-separated
  combinations). `normalize.mts` maps these onto the canonical `CURRICULA` list
  in `src/types.ts`, which is the single source of truth for both sides.
- **Fees.** A school may publish no fee, or only an upper bound. Values below
  AED 1,000/year are treated as placeholders and dropped — one school lists
  "AED 1". Render fees through `formatFeeRange()`, never by hand.
- **Descriptions.** KHDA publishes no prose. The ingest generates a factual
  one-liner from the structured fields, and preserves any hand-written
  description already in `schools.json` (matched by exact school name).
- **Omitted on purpose.** KHDA also publishes each school's principal name and
  a staff email address. Both are left out: personal data the app does not use,
  in a file served to the browser.

## When the markup changes

The parser is regex-based against specific ids and class names
(`lnkName`, `lblArea`, `lblCurriculums`, `fees-aed`, `khda-badge-single-dsib`,
`filter-details__label`). If KHDA restyles the directory the ingest will throw
`listing parse produced 0 rows` rather than silently writing an empty file.
Re-check those selectors against a cached page in `.cache/`.
