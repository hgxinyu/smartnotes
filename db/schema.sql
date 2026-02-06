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
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.25,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'rules',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notes ADD COLUMN IF NOT EXISTS category_slug TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS user_id UUID;
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notes_user_id_fkey'
  ) THEN
    ALTER TABLE notes
      ADD CONSTRAINT notes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes (created_at DESC);
CREATE INDEX IF NOT EXISTS notes_category_slug_idx ON notes (category_slug);
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes (user_id, created_at DESC);

-- Manual migration - 2026-02-04 (rich text + images)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS text_html TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS image_data TEXT;

-- Manual migration - 2026-02-04 (AI todo list)
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  source_note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE todos ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'todos_user_id_fkey'
  ) THEN
    ALTER TABLE todos
      ADD CONSTRAINT todos_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS todos_done_idx ON todos (is_done, created_at DESC);
CREATE INDEX IF NOT EXISTS todos_user_id_done_idx ON todos (user_id, is_done, created_at DESC);

-- Manual migration - 2026-02-04 (auth + user-scoped data)
-- Run this block separately on existing databases.
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

ALTER TABLE notes ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notes_user_id_fkey'
  ) THEN
    ALTER TABLE notes
      ADD CONSTRAINT notes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'todos_user_id_fkey'
  ) THEN
    ALTER TABLE todos
      ADD CONSTRAINT todos_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS todos_user_id_done_idx ON todos (user_id, is_done, created_at DESC);

-- Optional hardening after backfill:
-- ALTER TABLE notes ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE todos ALTER COLUMN user_id SET NOT NULL;

-- Manual migration - 2026-02-06 (labels for notes and todos)
CREATE TABLE IF NOT EXISTS labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0ea5e9',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS labels_user_lower_name_uidx ON labels (user_id, lower(name));
CREATE INDEX IF NOT EXISTS labels_user_created_idx ON labels (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS note_labels (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, label_id)
);

CREATE INDEX IF NOT EXISTS note_labels_label_idx ON note_labels (label_id);

CREATE TABLE IF NOT EXISTS todo_labels (
  todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, label_id)
);

CREATE INDEX IF NOT EXISTS todo_labels_label_idx ON todo_labels (label_id);
