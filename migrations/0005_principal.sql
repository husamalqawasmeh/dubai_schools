-- The principal KHDA publishes for each school.
--
-- Like khda_email this is scraped, so the ingest owns it and may overwrite it.
-- It changes more often than anything else on a school record — principals move
-- between schools and between years — so it is shown with the year it was read
-- rather than presented as permanent.
ALTER TABLE schools ADD COLUMN principal TEXT;
