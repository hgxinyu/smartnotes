import { NextResponse } from "next/server";
import { z } from "zod";

import { listTodoLabels, upsertUserLabel } from "@/lib/label-store";
import { requireCurrentUserId } from "@/lib/current-user";
import { query } from "@/lib/db";

const addLabelSchema = z.object({
  name: z.string().min(1).max(40)
});

type Params = {
  params: { id: string };
};

async function ensureUserTodo(userId: string, todoId: string) {
  const rows = await query("SELECT id FROM todos WHERE id = $1 AND user_id = $2 LIMIT 1", [todoId, userId]);
  return Boolean(rows[0]);
}

export async function POST(request: Request, { params }: Params) {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ownsTodo = await ensureUserTodo(userId, params.id);
    if (!ownsTodo) return NextResponse.json({ error: "Todo not found" }, { status: 404 });

    const body = await request.json();
    const { name } = addLabelSchema.parse(body);
    const label = await upsertUserLabel(userId, name);
    if (!label) return NextResponse.json({ error: "Invalid label name" }, { status: 400 });

    await query(
      `INSERT INTO todo_labels (todo_id, label_id)
       VALUES ($1, $2)
       ON CONFLICT (todo_id, label_id) DO NOTHING`,
      [params.id, label.id]
    );

    const labels = await listTodoLabels(userId, params.id);
    return NextResponse.json({ labels });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add label", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ownsTodo = await ensureUserTodo(userId, params.id);
    if (!ownsTodo) return NextResponse.json({ error: "Todo not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const labelId = searchParams.get("labelId");
    if (!labelId) return NextResponse.json({ error: "labelId is required" }, { status: 400 });

    await query(
      `DELETE FROM todo_labels tl
       USING labels l
       WHERE tl.todo_id = $1 AND tl.label_id = $2 AND l.id = tl.label_id AND l.user_id = $3`,
      [params.id, labelId, userId]
    );

    const labels = await listTodoLabels(userId, params.id);
    return NextResponse.json({ labels });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove label", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}

