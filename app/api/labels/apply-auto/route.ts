import { NextResponse } from "next/server";

import { ensureLabelSchema, listUserLabels } from "@/lib/label-store";
import { suggestLabelsForText } from "@/lib/labels";
import { requireCurrentUserId } from "@/lib/current-user";
import { query } from "@/lib/db";

type NoteRow = {
  id: string;
  text: string;
};

type TodoRow = {
  id: string;
  content: string;
};

export async function POST() {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureLabelSchema();

    const existingLabels = await listUserLabels(userId);
    const existingLabelNames = existingLabels.map((label) => label.name);
    const existingLabelByName = new Map(existingLabels.map((label) => [label.name.toLowerCase(), label.id]));

    const notes = await query<NoteRow>(
      `SELECT n.id, n.text
       FROM notes n
       WHERE n.user_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM note_labels nl WHERE nl.note_id = n.id
         )
       ORDER BY n.created_at DESC
       LIMIT 500`,
      [userId]
    );

    const todos = await query<TodoRow>(
      `SELECT t.id, t.content
       FROM todos t
       WHERE t.user_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM todo_labels tl WHERE tl.todo_id = t.id
         )
       ORDER BY t.created_at DESC
       LIMIT 500`,
      [userId]
    );

    let noteLinksAdded = 0;
    let todoLinksAdded = 0;

    for (const note of notes) {
      const text = String(note.text ?? "").trim();
      if (!text) continue;

      const suggestedLabels = await suggestLabelsForText(text, existingLabelNames);
      for (const labelName of suggestedLabels) {
        const labelId = existingLabelByName.get(labelName.toLowerCase());
        if (!labelId) continue;

        const inserted = await query(
          `INSERT INTO note_labels (note_id, label_id)
           VALUES ($1, $2)
           ON CONFLICT (note_id, label_id) DO NOTHING
           RETURNING note_id`,
          [note.id, labelId]
        );
        if (inserted[0]) noteLinksAdded += 1;
      }
    }

    for (const todo of todos) {
      const text = String(todo.content ?? "").trim();
      if (!text) continue;

      const suggestedLabels = await suggestLabelsForText(text, existingLabelNames);
      for (const labelName of suggestedLabels) {
        const labelId = existingLabelByName.get(labelName.toLowerCase());
        if (!labelId) continue;

        const inserted = await query(
          `INSERT INTO todo_labels (todo_id, label_id)
           VALUES ($1, $2)
           ON CONFLICT (todo_id, label_id) DO NOTHING
           RETURNING todo_id`,
          [todo.id, labelId]
        );
        if (inserted[0]) todoLinksAdded += 1;
      }
    }

    return NextResponse.json({
      summary: {
        notesScanned: notes.length,
        todosScanned: todos.length,
        noteLinksAdded,
        todoLinksAdded,
        labelsCreated: 0
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to apply automatic labels",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
