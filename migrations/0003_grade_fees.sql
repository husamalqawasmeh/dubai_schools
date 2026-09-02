-- Per-grade fees, from KHDA's fact sheets.
--
-- The listing page gives one fee range per school and, for most schools, it is
-- years stale — the listing says 2023-2024 where the fact sheets say 2026-2027.
-- The fact sheets are per grade and current, and they carry what the listing
-- has none of: mandatory extras, supplies, optional services (transport
-- included), the increase policy and the sibling discounts.
--
-- This is scraped data, so it lives beside `schools` under the same rule: the
-- ingest owns it, humans do not write here.
CREATE TABLE grade_fees (
  id              INTEGER PRIMARY KEY,
  school_id       INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  -- KHDA's own composite key for one grade of one curriculum at one school.
  center_id       TEXT NOT NULL,
  curr_id         TEXT NOT NULL,
  grade_id        TEXT NOT NULL,
  section_id      TEXT NOT NULL,
  school_name     TEXT NOT NULL,   -- as printed on the sheet, kept even when unmatched
  academic_year   TEXT,
  curriculum      TEXT,
  grade           TEXT NOT NULL,
  khda_rating     TEXT,
  tuition_aed     INTEGER,
  total_aed       INTEGER,         -- tuition plus mandatory extras
  mandatory       TEXT,            -- JSON [{name, amount}]
  supplies        TEXT,            -- JSON [{name, amount}]
  optional        TEXT,            -- JSON [{name, amount}]
  transport       TEXT,            -- the optional-services transport line, verbatim
  increase_policy TEXT,
  discounts       TEXT,            -- JSON [string]
  UNIQUE (center_id, curr_id, grade_id, section_id)
);
CREATE INDEX idx_gf_school ON grade_fees(school_id, tuition_aed);
CREATE INDEX idx_gf_name   ON grade_fees(school_name);
