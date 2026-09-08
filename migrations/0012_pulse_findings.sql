-- What Dubai Pulse publishes that this site does not carry yet.
--
-- A finding is a proposal, never a change. The scanner reads the open KHDA
-- datasets, compares each value against what we already hold, and writes a row
-- here for anything that differs — a field we have no column for, a value that
-- disagrees with ours, or a school in the register that is not in our table.
-- Nothing is applied. An admin reads the two values side by side and decides,
-- which is the whole point: Pulse and the KHDA site are refreshed on different
-- schedules, so "Pulse disagrees" often means "Pulse is stale", and a scanner
-- that wrote straight through would quietly undo good data.
CREATE TABLE pulse_findings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,

  dataset     TEXT NOT NULL,     -- e.g. 'khda_dubai_private_schools-open'
  pulse_ref   TEXT,              -- the dataset's own key for the record
  school_id   INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                                 -- NULL when Pulse lists a school we do not
  school_name TEXT,              -- as Pulse spells it, kept for the unmatched case

  kind        TEXT NOT NULL,     -- new_school | new_field | changed_value
  field       TEXT NOT NULL,     -- the Pulse attribute name
  pulse_value TEXT,              -- what Pulse says
  our_value   TEXT,              -- what we hold, so the difference is readable

  status      TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | ignored
  decided_by  TEXT,
  decided_at  TEXT,
  note        TEXT,

  -- A finding that reappears on the next scan is the same finding. Re-running
  -- the scanner must not bury a queue in duplicates, so a repeat touches
  -- last_seen_at and nothing else — including, deliberately, not the status:
  -- something ignored once stays ignored.
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL
);

-- The identity of a finding, and what makes a re-scan idempotent.
CREATE UNIQUE INDEX idx_pulse_identity
  ON pulse_findings(dataset, COALESCE(school_id, -1), COALESCE(school_name, ''), field, COALESCE(pulse_value, ''));
-- The admin screen's only query: what is still waiting.
CREATE INDEX idx_pulse_status ON pulse_findings(status, last_seen_at);

-- When the scanner last ran, and what came of it. Without this the admin page
-- cannot tell "Pulse has nothing new" from "the scan has never run" — two very
-- different things to show someone.
CREATE TABLE pulse_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  ok          INTEGER NOT NULL DEFAULT 0,
  datasets    INTEGER NOT NULL DEFAULT 0,
  rows_read   INTEGER NOT NULL DEFAULT 0,
  found_new   INTEGER NOT NULL DEFAULT 0,
  message     TEXT
);
