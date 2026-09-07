-- When an item was raised, and when it was finished.
--
-- Both optional and both plain dates, not timestamps: this is a plan, and
-- "which day" is the only precision anyone will use. Kept apart from
-- created_at/updated_at, which are the row's own history — an item can be
-- raised in the list long after the row was typed, or backdated to when the
-- work actually started.
ALTER TABLE roadmap ADD COLUMN entry_date TEXT;
ALTER TABLE roadmap ADD COLUMN completion_date TEXT;
