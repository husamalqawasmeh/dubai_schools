-- Where a school's uniform is actually sold.
--
-- Its own table, not columns on `schools`, for two reasons. A school often has
-- more than one outlet — the appointed supplier plus a branch or two, or a
-- second-hand sale run by the parent association — and a set of columns can
-- only hold one. And this is contributed data: it arrives through Communicate
-- or from the school itself, where everything on `schools` comes from KHDA.
-- Keeping the two apart means a KHDA re-import can never overwrite it.
--
-- Nothing here is required except the school and a name. A supplier with only
-- a name and a phone number is still worth listing; waiting for a full address
-- would mean listing nothing.
CREATE TABLE uniform_suppliers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id    INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  name         TEXT    NOT NULL,          -- "Zaks Uniforms", "The school office"
  kind         TEXT    NOT NULL DEFAULT 'supplier',
                                          -- supplier | school_shop | second_hand | online
  address      TEXT,
  area         TEXT,                      -- Dubai area, so it can sit beside the school's
  phone        TEXT,
  email        TEXT,
  website      TEXT,
  opening_hours TEXT,                     -- free text: "Sun-Thu 9-6, Sat 10-4"

  -- What they actually sell, since some outlets carry only part of the kit.
  sells_uniform INTEGER NOT NULL DEFAULT 1,
  sells_pe_kit  INTEGER NOT NULL DEFAULT 0,
  sells_books   INTEGER NOT NULL DEFAULT 0,

  -- KHDA does not publish any of this, so every row has a provenance and a
  -- moderation state. Nothing reaches a visitor until published_at is set —
  -- the same gate the news table uses, for the same reason.
  note         TEXT,
  source       TEXT,                      -- 'school' | 'parent' | 'admin'
  published_at TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

CREATE INDEX idx_uniform_school ON uniform_suppliers(school_id);
-- The site's only query: published outlets for one school.
CREATE INDEX idx_uniform_live   ON uniform_suppliers(school_id, published_at);
