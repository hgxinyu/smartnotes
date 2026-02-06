import { NextResponse } from "next/server";

import { ensureLabelSchema } from "@/lib/label-store";
import { requireCurrentUserId } from "@/lib/current-user";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureLabelSchema();

    const todos = await query(
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
    return NextResponse.json({ todos });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load todos", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
