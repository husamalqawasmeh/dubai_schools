-- Rejecting, freezing, and asking a supplier a question.
--
-- Four states, and they are not the same thing:
--   pending   nobody has looked yet
--   approved  live on /suppliers
--   rejected  looked at and turned down — it should not have been sent
--   frozen    was fine, is off the page for now — details to check, a business
--             that has gone quiet, a complaint being looked into
--
-- Rejected and frozen both hide a listing, and collapsing them would lose the
-- only thing worth recording about a listing that is down: whether it is coming
-- back. "Hidden" was the earlier name for what is now frozen; nothing has been
-- approved yet so the rename costs nothing, but the UPDATE is here anyway
-- because a migration that assumes an empty table is a migration that breaks
-- the one time it is not.
UPDATE providers SET status = 'frozen' WHERE status = 'hidden';

-- The last question put to a supplier, so the queue shows what is being waited
-- on. One question at a time rather than a thread: a supplier who needs two
-- rounds of clarification is a supplier to telephone.
ALTER TABLE providers ADD COLUMN last_query TEXT;
ALTER TABLE providers ADD COLUMN last_query_at TEXT;
ALTER TABLE providers ADD COLUMN last_query_by TEXT;
