-- When the article was published, as distinct from when we found it.
--
-- The table already had created_at (the row) and scanned_at (the run) and
-- published_at (when we let it onto the site). None of those is the thing a
-- reader wants at the front of a news line: they want the date the newspaper
-- printed it. The feed carries that and it was being read and thrown away.
--
-- Null for everything scanned before this column existed. The pages fall back
-- to the scan date for those rather than showing nothing, and do not pretend
-- the two are the same.
ALTER TABLE school_news ADD COLUMN source_published_at TEXT;

-- The real article, once something has resolved it. Google News hands out
-- wrapper links (news.google.com/rss/articles/...) which say nothing about who
-- wrote the piece and cannot be resolved from a Worker — Google answers
-- Cloudflare's egress with 503, the same refusal that moved the fetching to the
-- GitHub runner in the first place. So the runner resolves them and sends the
-- destination along with the wrapper.
ALTER TABLE school_news ADD COLUMN source_final_url TEXT;
