-- The review trail for scanned news.
--
-- rejected_at exists so a rejected item stays on the record. Deleting it would
-- mean the next morning's scan finds the same story, summarises it again, and
-- mails it again — the scanner has to remember what was turned down, not just
-- what was accepted.
ALTER TABLE school_news ADD COLUMN rejected_at TEXT;
ALTER TABLE school_news ADD COLUMN scanned_at TEXT;

-- One row per story. The unique index is the dedupe: a story that appears in
-- three outlets is still one link, and re-running the scan cannot double it.
CREATE UNIQUE INDEX idx_news_source_url ON school_news(source_url)
  WHERE source_url IS NOT NULL;
