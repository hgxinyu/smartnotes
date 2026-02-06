import { NextResponse } from "next/server";

import { ensureLabelSchema } from "@/lib/label-store";
import { requireCurrentUserId } from "@/lib/current-user";
import { query } from "@/lib/db";

type Params = {
  params: { id: string };
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureLabelSchema();

    const labelRows = await query<{ id: string; name: string; color: string }>(
      "SELECT id, name, color FROM labels WHERE id = $1 AND user_id = $2 LIMIT 1",
      [params.id, userId]
    );
    const label = labelRows[0];
    if (!label) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    const notes = await query(
      `SELECT n.id, n.text, n.text_html, n.image_data, n.created_at
       FROM note_labels nl
       JOIN notes n ON n.id = nl.note_id
       WHERE nl.label_id = $1 AND n.user_id = $2
       ORDER BY n.created_at DESC
       LIMIT 300`,
      [label.id, userId]
    );

    const todos = await query(
      `SELECT t.id, t.content, t.is_done, t.created_at
       FROM todo_labels tl
       JOIN todos t ON t.id = tl.todo_id
       WHERE tl.label_id = $1 AND t.user_id = $2
       ORDER BY t.is_done ASC, t.created_at DESC
       LIMIT 300`,
      [label.id, userId]
    );

    return NextResponse.json({
      label,
      notes,
      todos,
      summary: {
        noteCount: notes.length,
        todoCount: todos.length
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load label items",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

