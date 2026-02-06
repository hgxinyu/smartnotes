import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureLabelSchema } from "@/lib/label-store";
import { requireCurrentUserId } from "@/lib/current-user";
import { query } from "@/lib/db";

const updateTodoSchema = z.object({
  isDone: z.boolean()
});

type Params = {
  params: {
    id: string;
  };
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureLabelSchema();

    const body = await request.json();
    const { isDone } = updateTodoSchema.parse(body);
    const rows = await query(
      `UPDATE todos
       SET is_done = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [isDone, params.id, userId]
    );

    if (!rows[0]) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    const withLabels = await query(
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
       WHERE t.id = $1 AND t.user_id = $2
       GROUP BY t.id`,
      [rows[0].id, userId]
    );

    return NextResponse.json({ todo: withLabels[0] });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update todo", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
