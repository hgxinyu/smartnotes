import { NextResponse } from "next/server";
import { z } from "zod";

import { listNoteLabels, upsertUserLabel } from "@/lib/label-store";
import { requireCurrentUserId } from "@/lib/current-user";
import { query } from "@/lib/db";

const addLabelSchema = z.object({
  name: z.string().min(1).max(40)
});

type Params = {
  params: { id: string };
};

async function ensureUserNote(userId: string, noteId: string) {
  const rows = await query("SELECT id FROM notes WHERE id = $1 AND user_id = $2 LIMIT 1", [noteId, userId]);
  return Boolean(rows[0]);
}

export async function POST(request: Request, { params }: Params) {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ownsNote = await ensureUserNote(userId, params.id);
    if (!ownsNote) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    const body = await request.json();
    const { name } = addLabelSchema.parse(body);
    const label = await upsertUserLabel(userId, name);
    if (!label) return NextResponse.json({ error: "Invalid label name" }, { status: 400 });

    await query(
      `INSERT INTO note_labels (note_id, label_id)
       VALUES ($1, $2)
       ON CONFLICT (note_id, label_id) DO NOTHING`,
      [params.id, label.id]
    );

    const labels = await listNoteLabels(userId, params.id);
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
    const ownsNote = await ensureUserNote(userId, params.id);
    if (!ownsNote) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const labelId = searchParams.get("labelId");
    if (!labelId) return NextResponse.json({ error: "labelId is required" }, { status: 400 });

    await query(
      `DELETE FROM note_labels nl
       USING labels l
       WHERE nl.note_id = $1 AND nl.label_id = $2 AND l.id = nl.label_id AND l.user_id = $3`,
      [params.id, labelId, userId]
    );

    const labels = await listNoteLabels(userId, params.id);
    return NextResponse.json({ labels });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove label", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}

