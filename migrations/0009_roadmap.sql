-- Planned changes to the site, in the order they should happen.
--
-- position, not created_at, decides the order: the point of the list is that it
-- can be reordered, and a list you can only append to is a log rather than a
-- plan. Gaps of 10 leave room to insert between two items later without
-- renumbering the whole list.
CREATE TABLE roadmap (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  position   INTEGER NOT NULL,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE INDEX idx_roadmap_position ON roadmap(position);

INSERT INTO roadmap (title, done, position, created_at, updated_at) VALUES
  ('Fix the chatbot', 0, 10, datetime('now'), datetime('now')),
  ('Fix the daily news updates', 0, 20, datetime('now'), datetime('now')),
  ('Add school update news', 0, 30, datetime('now'), datetime('now')),
  ('Email schools, and send updates to schools', 0, 40, datetime('now'), datetime('now')),
  ('Add pictures of every school to its profile', 0, 50, datetime('now'), datetime('now')),
  ('Fix travel time so it calculates and shows the journey to parents', 0, 60, datetime('now'), datetime('now'));
