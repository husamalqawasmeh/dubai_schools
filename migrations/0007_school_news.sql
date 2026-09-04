-- Short news items about schools, shown newest first.
--
-- Nothing reaches the page until published_at is set, so an item can be
-- drafted, checked and dated before anyone sees it. school_id is nullable
-- because plenty of news is about schooling in Dubai generally — a KHDA
-- announcement, a term-date change — and does not belong to one school.
CREATE TABLE school_news (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id    INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  headline     TEXT NOT NULL,
  body         TEXT NOT NULL,
  source_name  TEXT,
  source_url   TEXT,
  published_at TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_news_published ON school_news(published_at DESC);
