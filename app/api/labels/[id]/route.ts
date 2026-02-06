import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureLabelSchema } from "@/lib/label-store";
import { normalizeLabelName } from "@/lib/labels";
import { requireCurrentUserId } from "@/lib/current-user";
import { query } from "@/lib/db";

const updateLabelSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

type Params = {
  params: { id: string };
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureLabelSchema();

    const body = await request.json();
    const { name, color } = updateLabelSchema.parse(body);
    const normalized = normalizeLabelName(name);
    if (!normalized) {
      return NextResponse.json({ error: "Invalid label name" }, { status: 400 });
    }

    const rows = await query(
      `UPDATE labels
       SET name = $1, color = $2
       WHERE id = $3 AND user_id = $4
       RETURNING id, name, color`,
      [normalized, color, params.id, userId]
    );
    if (!rows[0]) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }
    return NextResponse.json({ label: rows[0] });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update label", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureLabelSchema();

    const rows = await query("DELETE FROM labels WHERE id = $1 AND user_id = $2 RETURNING id", [params.id, userId]);
    if (!rows[0]) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete label", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
