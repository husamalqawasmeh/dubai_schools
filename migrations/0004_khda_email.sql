-- The contact address KHDA publishes for each school.
--
-- Kept separate from school_details.official_email, which is an address the
-- school gave us directly. This one is scraped, so the ingest owns it and may
-- overwrite it; the school-supplied one is human-owned and never is.
--
-- Free-mail providers are filtered out at ingest: a gmail.com address is a
-- personal mailbox that happens to be listed, not an institutional contact.
ALTER TABLE schools ADD COLUMN khda_email TEXT;
CREATE INDEX idx_schools_email ON schools(khda_email);
