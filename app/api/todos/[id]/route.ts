import { NextResponse } from "next/server";
import { z } from "zod";

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
    const body = await request.json();
    const { isDone } = updateTodoSchema.parse(body);
    const rows = await query(
      `UPDATE todos
       SET is_done = $1
       WHERE id = $2
       RETURNING id, content, is_done, source_note_id, created_at`,
      [isDone, params.id]
    );

    if (!rows[0]) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    return NextResponse.json({ todo: rows[0] });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update todo", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}

