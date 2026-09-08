-- Suppliers and services that register themselves.
--
-- Distinct from uniform_suppliers (0011), which records where one school's
-- uniform is sold and is entered by us or by the school. This table is filled
-- in by the business itself through a public form, so it carries a moderation
-- state and uniform_suppliers does not. Two tables rather than one because the
-- trust model is different: one is a fact we hold about a school, the other is
-- a claim someone makes about themselves.
CREATE TABLE providers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,

  name        TEXT NOT NULL,
  category    TEXT NOT NULL,   -- uniforms | books | used_books | stationery
                               -- | transport | tutoring | activities | other
  summary     TEXT NOT NULL,   -- one line, shown in the listing
  detail      TEXT,            -- longer, shown when expanded
  areas       TEXT,            -- free text: "Al Barsha, Jumeirah, online"

  contact_name TEXT,
  phone        TEXT,
  email        TEXT,
  website      TEXT,

  -- pending until someone looks at it; approved to appear; hidden to take it
  -- down again without losing the record. Nothing is visible on the public
  -- page except approved, which is the whole point of the column.
  status      TEXT NOT NULL DEFAULT 'pending',
  note        TEXT,            -- why it was hidden, or anything worth keeping
  decided_by  TEXT,
  decided_at  TEXT,

  -- Kept for rate-limiting and for tracing an abusive submission back.
  submitted_ip TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- The public page's only query: approved, by category, newest first.
CREATE INDEX idx_providers_live ON providers(status, category, created_at);
-- The admin queue: whatever is waiting.
CREATE INDEX idx_providers_status ON providers(status, created_at);
