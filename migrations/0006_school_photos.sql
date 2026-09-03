-- Photographs of a school, from any source, none of them published until a
-- human says so.
--
-- publish_ok is the gate the site reads. It starts at 0 for every row and only
-- an admin review sets it to 1, so a photograph that has been fetched but not
-- looked at can never reach a visitor. review_state records what the reviewer
-- decided; publish_ok records what the site is allowed to do. They are separate
-- because "rejected" and "not yet reviewed" are different facts, and collapsing
-- them into one boolean loses the difference.
--
-- For Street View we store the panorama id, not the image. Google's terms allow
-- caching the identifier but not the imagery, and a pano id stays valid while
-- the picture behind it gets refreshed — so the id is both the licensed thing
-- to keep and the more durable one.
CREATE TABLE school_photos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id    INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  source       TEXT    NOT NULL,               -- 'streetview' | 'school' | 'admin'
  pano_id      TEXT,                           -- Street View panorama
  image_url    TEXT,                           -- school-supplied image
  heading      REAL,                           -- camera bearing toward the building
  caption      TEXT,
  attribution  TEXT,
  publish_ok   INTEGER NOT NULL DEFAULT 0,     -- 0 = never show, 1 = cleared
  review_state TEXT    NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  reviewed_at  TEXT,
  reviewed_by  TEXT,
  note         TEXT,
  created_at   TEXT    NOT NULL,
  UNIQUE (school_id, source, pano_id)
);

CREATE INDEX idx_photos_school ON school_photos(school_id);
CREATE INDEX idx_photos_state  ON school_photos(review_state);
-- The site's only query: cleared photos for one school.
CREATE INDEX idx_photos_live   ON school_photos(school_id, publish_ok);
