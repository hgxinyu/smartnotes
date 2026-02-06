import { query } from "@/lib/db";
import { normalizeLabelName, pickLabelColor } from "@/lib/labels";

export type LabelRecord = {
  id: string;
  name: string;
  color: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __smartnotesLabelSchemaReady__: boolean | undefined;
}

export async function ensureLabelSchema() {
  if (global.__smartnotesLabelSchemaReady__) return;

  await query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await query(
    `CREATE TABLE IF NOT EXISTS labels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#0ea5e9',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await query("CREATE UNIQUE INDEX IF NOT EXISTS labels_user_lower_name_uidx ON labels (user_id, lower(name))");
  await query("CREATE INDEX IF NOT EXISTS labels_user_created_idx ON labels (user_id, created_at DESC)");

  await query(
    `CREATE TABLE IF NOT EXISTS note_labels (
      note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, label_id)
    )`
  );
  await query("CREATE INDEX IF NOT EXISTS note_labels_label_idx ON note_labels (label_id)");

  await query(
    `CREATE TABLE IF NOT EXISTS todo_labels (
      todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (todo_id, label_id)
    )`
  );
  await query("CREATE INDEX IF NOT EXISTS todo_labels_label_idx ON todo_labels (label_id)");

  global.__smartnotesLabelSchemaReady__ = true;
}

export async function listUserLabels(userId: string) {
  await ensureLabelSchema();
  return query<LabelRecord>("SELECT id, name, color FROM labels WHERE user_id = $1 ORDER BY name ASC", [userId]);
}

export async function listUserLabelsWithCounts(userId: string) {
  await ensureLabelSchema();
  return query<LabelRecord & { note_count: number; todo_count: number; created_at: string }>(
    `SELECT l.id, l.name, l.color, l.created_at,
            COALESCE(n.note_count, 0)::int AS note_count,
            COALESCE(t.todo_count, 0)::int AS todo_count
     FROM labels l
     LEFT JOIN (
       SELECT nl.label_id, COUNT(*) AS note_count
       FROM note_labels nl
       JOIN notes n ON n.id = nl.note_id
       WHERE n.user_id = $1
       GROUP BY nl.label_id
     ) n ON n.label_id = l.id
     LEFT JOIN (
       SELECT tl.label_id, COUNT(*) AS todo_count
       FROM todo_labels tl
       JOIN todos td ON td.id = tl.todo_id
       WHERE td.user_id = $1
       GROUP BY tl.label_id
     ) t ON t.label_id = l.id
     WHERE l.user_id = $1
     ORDER BY l.name ASC`,
    [userId]
  );
}

export async function upsertUserLabel(userId: string, name: string, color?: string) {
  await ensureLabelSchema();
  const normalizedName = normalizeLabelName(name);
  if (!normalizedName) return null;

  const existing = await query<LabelRecord>(
    "SELECT id, name, color FROM labels WHERE user_id = $1 AND lower(name) = lower($2) LIMIT 1",
    [userId, normalizedName]
  );
  if (existing[0]) return existing[0];

  const selectedColor = /^#[0-9a-fA-F]{6}$/.test(color ?? "") ? String(color) : pickLabelColor(normalizedName);

  try {
    const inserted = await query<LabelRecord>(
      `INSERT INTO labels (user_id, name, color)
       VALUES ($1, $2, $3)
       RETURNING id, name, color`,
      [userId, normalizedName, selectedColor]
    );
    return inserted[0] ?? null;
  } catch {
    const conflict = await query<LabelRecord>(
      "SELECT id, name, color FROM labels WHERE user_id = $1 AND lower(name) = lower($2) LIMIT 1",
      [userId, normalizedName]
    );
    return conflict[0] ?? null;
  }
}

export async function listNoteLabels(userId: string, noteId: string) {
  await ensureLabelSchema();
  return query<LabelRecord>(
    `SELECT l.id, l.name, l.color
     FROM note_labels nl
     JOIN labels l ON l.id = nl.label_id
     JOIN notes n ON n.id = nl.note_id
     WHERE n.user_id = $1 AND n.id = $2
     ORDER BY l.name ASC`,
    [userId, noteId]
  );
}

export async function listTodoLabels(userId: string, todoId: string) {
  await ensureLabelSchema();
  return query<LabelRecord>(
    `SELECT l.id, l.name, l.color
     FROM todo_labels tl
     JOIN labels l ON l.id = tl.label_id
     JOIN todos td ON td.id = tl.todo_id
     WHERE td.user_id = $1 AND td.id = $2
     ORDER BY l.name ASC`,
    [userId, todoId]
  );
}
