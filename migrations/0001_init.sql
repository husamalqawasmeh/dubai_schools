-- Dubai Schools — initial schema.
--
-- Two rules shape this file:
--   1. `schools` is a faithful mirror of KHDA. The ingest may overwrite any
--      column in it. Nothing a human types ever lives here.
--   2. Everything a human owns lives in a table the ingest has no write path
--      to. That makes "a re-scrape cannot clobber this" structural rather
--      than a convention someone has to remember.

-- ---------------------------------------------------------------------------
-- The KHDA mirror
-- ---------------------------------------------------------------------------
CREATE TABLE schools (
  id             INTEGER PRIMARY KEY,
  khda_id        TEXT NOT NULL UNIQUE,
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  area           TEXT NOT NULL,
  curricula      TEXT NOT NULL,          -- JSON array
  khda_rating    TEXT NOT NULL,          -- six tiers, or 'Not rated'
  fee_min_aed    INTEGER,                -- NULL when unpublished, never 0
  fee_max_aed    INTEGER,
  fee_year       TEXT,                   -- '2023-2024'; NULL for the 26 without one
  fee_note       TEXT,
  -- Generated, so the band can never drift from the fee it describes.
  -- Cuts sit on the real quartiles of the 207 priced schools.
  fee_band       TEXT GENERATED ALWAYS AS (
                   CASE WHEN fee_max_aed IS NULL  THEN NULL
                        WHEN fee_max_aed < 25000  THEN 'acceptable'
                        WHEN fee_max_aed < 50000  THEN 'medium'
                        WHEN fee_max_aed < 90000  THEN 'high'
                        ELSE 'very_high' END) VIRTUAL,
  grade_range    TEXT,
  students_total INTEGER,                -- KHDA publishes this
  website        TEXT,
  phone          TEXT,
  address        TEXT,
  lat            REAL,
  lng            REAL,
  description    TEXT,
  first_seen_at  TEXT NOT NULL,
  last_seen_at   TEXT NOT NULL,
  delisted_at    TEXT,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_schools_area   ON schools(area);
CREATE INDEX idx_schools_rating ON schools(khda_rating);
CREATE INDEX idx_schools_fee    ON schools(fee_max_aed);

-- ---------------------------------------------------------------------------
-- Human-owned data. The ingest never writes below this line.
-- ---------------------------------------------------------------------------

-- Field-level corrections applied on top of the scraped row at read time.
CREATE TABLE school_overrides (
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  field     TEXT    NOT NULL,
  value     TEXT,                        -- JSON-encoded; NULL blanks the field
  reason    TEXT    NOT NULL,            -- required: why the source is wrong
  set_by    INTEGER,
  set_at    TEXT    NOT NULL,
  PRIMARY KEY (school_id, field)
);

-- Details KHDA does not publish at all. Verified against 233 cached pages:
-- no teacher count, no admin staff count, nothing about transport, and the
-- only email exposed is the principal's personal address.
CREATE TABLE school_details (
  school_id             INTEGER PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  official_email        TEXT,
  teachers_total        INTEGER,
  admin_staff_total     INTEGER,
  transport_offered     INTEGER,         -- 1 yes / 0 no / NULL not asked yet
  transport_areas       TEXT,            -- JSON array
  transport_fee_min_aed INTEGER,
  transport_fee_max_aed INTEGER,
  transport_notes       TEXT,
  updated_by            INTEGER,
  updated_at            TEXT
);

-- ---------------------------------------------------------------------------
-- Ingest runs. A run writes nothing to `schools`; it proposes and waits.
-- ---------------------------------------------------------------------------
CREATE TABLE ingest_runs (
  id           TEXT PRIMARY KEY,
  status       TEXT NOT NULL,   -- queued|running|proposed|applied|rejected|failed
  trigger      TEXT NOT NULL,   -- manual|schedule
  started_by   INTEGER,
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  rows_seen    INTEGER,
  rows_changed INTEGER,
  summary_md   TEXT,
  model        TEXT,
  cost_usd     REAL,
  error        TEXT
);

CREATE TABLE ingest_changes (
  id         INTEGER PRIMARY KEY,
  run_id     TEXT NOT NULL REFERENCES ingest_runs(id) ON DELETE CASCADE,
  khda_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,   -- added|updated|delisted
  field      TEXT,
  old_value  TEXT,
  new_value  TEXT,
  verdict    TEXT NOT NULL,   -- routine|review|suspect
  rationale  TEXT,
  decision   TEXT,            -- NULL until an admin acts: accept|skip
  decided_by INTEGER,
  decided_at TEXT
);
CREATE INDEX idx_changes_run ON ingest_changes(run_id, verdict);

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
CREATE TABLE admin_users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,   -- pbkdf2$<iterations>$<salt_b64>$<hash_b64>
  totp_secret   TEXT,
  role          TEXT NOT NULL DEFAULT 'editor',   -- owner|editor|moderator
  failed_count  INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,   -- SHA-256 of the cookie value, never the value
  user_id    INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip         TEXT,
  user_agent TEXT
);

CREATE TABLE audit_log (
  id        INTEGER PRIMARY KEY,
  at        TEXT NOT NULL,
  user_id   INTEGER,
  action    TEXT NOT NULL,
  entity    TEXT,
  entity_id TEXT,
  detail    TEXT,
  ip        TEXT
);
CREATE INDEX idx_audit_at ON audit_log(at DESC);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT,
  updated_by INTEGER
);

-- ---------------------------------------------------------------------------
-- Parent feedback. Moderated before it appears anywhere public.
-- sentiment 0 is "Rather not comment": stored and tallied, excluded from the
-- average, exactly as 'Not rated' is on the KHDA scale.
-- ---------------------------------------------------------------------------
CREATE TABLE school_feedback (
  id           INTEGER PRIMARY KEY,
  school_id    INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sentiment    INTEGER NOT NULL,   -- 0 abstain 1 neutral 2 good 3 great 4 amazing
  comment      TEXT,
  author_name  TEXT,
  submitted_at TEXT NOT NULL,
  ip_hash      TEXT NOT NULL,      -- hashed for rate limiting; never the raw IP
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending|published|rejected
  moderated_by INTEGER,
  moderated_at TEXT
);
CREATE INDEX idx_feedback_school ON school_feedback(school_id, status);
