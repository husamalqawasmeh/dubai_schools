-- Everything the public sends in, from any of the four audiences.
--
-- One table rather than four, because the moderation queue is the same job
-- whoever wrote it: read it, decide, publish or reject. Nothing here is
-- public until an admin sets status='published'.
CREATE TABLE submissions (
  id           INTEGER PRIMARY KEY,
  audience     TEXT NOT NULL,   -- student|parent|school|site
  kind         TEXT NOT NULL,   -- comment|info_request|school_details
  school_id    INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  school_name  TEXT,            -- as typed, kept even if the school is unmatched
  author_name  TEXT,            -- display name; optional
  contact      TEXT,            -- email or phone, for a reply. Never published.
  message      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending|published|rejected
  moderated_by INTEGER,
  moderated_at TEXT,
  moderator_note TEXT,
  ip_hash      TEXT NOT NULL,   -- hashed, for rate limiting; never the raw IP
  user_agent   TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_sub_status ON submissions(status, created_at DESC);
CREATE INDEX idx_sub_school ON submissions(school_id, status);
-- Rate limiting reads this hot, so give it its own index.
CREATE INDEX idx_sub_rate ON submissions(ip_hash, created_at DESC);
