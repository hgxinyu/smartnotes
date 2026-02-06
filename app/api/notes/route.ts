import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureLabelSchema, listUserLabels } from "@/lib/label-store";
import { suggestLabelsForText } from "@/lib/labels";
import { requireCurrentUserId } from "@/lib/current-user";
import { query } from "@/lib/db";
import { classifyIntake } from "@/lib/intake";

const createNoteSchema = z
  .object({
    text: z.string().max(4000).default(""),
    imageData: z.string().max(3_000_000).optional()
  })
  .refine((value) => value.text.trim().length > 0 || Boolean(value.imageData), {
    message: "Either text or an image is required"
  });

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureLabelSchema();

    const notes = await query(
      `SELECT n.id, n.text, n.text_html, n.image_data, n.created_at,
              COALESCE(
                json_agg(
                  json_build_object('id', l.id, 'name', l.name, 'color', l.color)
                  ORDER BY l.name
                ) FILTER (WHERE l.id IS NOT NULL),
                '[]'::json
              ) AS labels
       FROM notes n
       LEFT JOIN note_labels nl ON nl.note_id = n.id
       LEFT JOIN labels l ON l.id = nl.label_id
       WHERE n.user_id = $1
       GROUP BY n.id
       ORDER BY n.created_at DESC
       LIMIT 300`,
      [userId]
    );

    return NextResponse.json({ notes });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load notes", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureLabelSchema();

    const body = await request.json();
    const { text, imageData } = createNoteSchema.parse(body);
    const normalizedText = text.trim();
    const intake = await classifyIntake(normalizedText);
    const noteEntries = [...intake.notes];
    const todoEntries = [...intake.todos];
    const existingLabels = await listUserLabels(userId);
    const existingLabelNames = existingLabels.map((label) => label.name);
    const existingLabelByName = new Map(existingLabels.map((label) => [label.name.toLowerCase(), label.id]));

    await query(
      `INSERT INTO categories (slug, name, label, color)
       VALUES ('uncategorized', 'Uncategorized', 'General', '#475569')
       ON CONFLICT (slug) DO NOTHING`
    );

    // Images are always stored as notes. Attach to first note; create one if needed.
    if (imageData) {
      if (noteEntries.length === 0) {
        noteEntries.push(normalizedText || "Image note");
      }
    }

    const created = [];
    for (let index = 0; index < noteEntries.length; index += 1) {
      const entry = noteEntries[index];
      const inserted = await query(
        `INSERT INTO notes (user_id, text, text_html, image_data, category_slug, confidence, tags, source)
         VALUES ($1, $2, $3, $4, 'uncategorized', 1.0, '{}', 'rules')
         RETURNING id, text, text_html, image_data, created_at`,
        [userId, entry, null, index === 0 ? imageData ?? null : null]
      );
      created.push(inserted[0]);
    }

    for (const note of created) {
      const suggestedLabels = await suggestLabelsForText(String(note.text ?? ""), existingLabelNames);
      for (const labelName of suggestedLabels) {
        const labelId = existingLabelByName.get(labelName.toLowerCase());
        if (!labelId) continue;
        await query(
          `INSERT INTO note_labels (note_id, label_id)
           VALUES ($1, $2)
           ON CONFLICT (note_id, label_id) DO NOTHING`,
          [note.id, labelId]
        );
      }
    }

    for (const todo of todoEntries) {
      const insertedTodo = await query<{ id: string; content: string }>(
        `INSERT INTO todos (user_id, content, source_note_id)
         VALUES ($1, $2, NULL)
         RETURNING id, content`,
        [userId, todo]
      );

      const todoId = insertedTodo[0]?.id;
      if (!todoId) continue;

      const suggestedLabels = await suggestLabelsForText(todo, existingLabelNames);
      for (const labelName of suggestedLabels) {
        const labelId = existingLabelByName.get(labelName.toLowerCase());
        if (!labelId) continue;
        await query(
          `INSERT INTO todo_labels (todo_id, label_id)
           VALUES ($1, $2)
           ON CONFLICT (todo_id, label_id) DO NOTHING`,
          [todoId, labelId]
        );
      }
    }

    const ids = created.map((item) => item.id);
    const notes =
      ids.length === 0
        ? []
        : await query(
            `SELECT n.id, n.text, n.text_html, n.image_data, n.created_at,
                    COALESCE(
                      json_agg(
                        json_build_object('id', l.id, 'name', l.name, 'color', l.color)
                        ORDER BY l.name
                      ) FILTER (WHERE l.id IS NOT NULL),
                      '[]'::json
                    ) AS labels
       FROM notes n
       LEFT JOIN note_labels nl ON nl.note_id = n.id
       LEFT JOIN labels l ON l.id = nl.label_id
       WHERE n.id = ANY($1::uuid[]) AND n.user_id = $2
       GROUP BY n.id
       ORDER BY n.created_at DESC`,
            [ids, userId]
          );

    const todoItems = await query(
      `SELECT t.id, t.content, t.is_done, t.source_note_id, t.created_at,
              COALESCE(
                json_agg(
                  json_build_object('id', l.id, 'name', l.name, 'color', l.color)
                  ORDER BY l.name
                ) FILTER (WHERE l.id IS NOT NULL),
                '[]'::json
              ) AS labels
       FROM todos t
       LEFT JOIN todo_labels tl ON tl.todo_id = t.id
       LEFT JOIN labels l ON l.id = tl.label_id
       WHERE t.user_id = $1
       GROUP BY t.id
       ORDER BY t.is_done ASC, t.created_at DESC
      LIMIT 200`,
      [userId]
    );

    return NextResponse.json(
      {
        notes,
        todos: todoItems,
        created: {
          notes: notes.length,
          todos: todoEntries.length
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create note", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
