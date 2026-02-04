CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image_url TEXT,
  last_provider TEXT,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#475569',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO categories (slug, name, label, color)
VALUES
  ('grocery', 'Grocery', 'Shopping', '#2d6a4f'),
  ('tasks', 'Tasks', 'To-do', '#1d4ed8'),
  ('reminders', 'Reminders', 'Remember', '#7c3aed'),
  ('ideas', 'Ideas', 'Inspiration', '#b45309'),
  ('work', 'Work', 'Work', '#0f766e'),
  ('health', 'Health', 'Health', '#be123c'),
  ('finance', 'Finance', 'Money', '#4338ca'),
  ('uncategorized', 'Uncategorized', 'General', '#475569')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.25,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'rules',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notes ADD COLUMN IF NOT EXISTS category_slug TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'rules';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.25;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'category'
  ) THEN
    EXECUTE 'UPDATE notes SET category_slug = category WHERE category_slug IS NULL';
  END IF;
END $$;

UPDATE notes SET category_slug = 'uncategorized' WHERE category_slug IS NULL;
ALTER TABLE notes ALTER COLUMN category_slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notes_category_slug_fkey'
  ) THEN
    ALTER TABLE notes
      ADD CONSTRAINT notes_category_slug_fkey
      FOREIGN KEY (category_slug) REFERENCES categories(slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes (created_at DESC);
CREATE INDEX IF NOT EXISTS notes_category_slug_idx ON notes (category_slug);

-- Manual migration - 2026-02-04 (rich text + images)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS text_html TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS image_data TEXT;

-- Manual migration - 2026-02-04 (AI todo list)
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  source_note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS todos_done_idx ON todos (is_done, created_at DESC);
