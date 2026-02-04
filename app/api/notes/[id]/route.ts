import { NextResponse } from "next/server";
import { z } from "zod";

import { isCategory } from "@/lib/categories";
import { query } from "@/lib/db";

const updateSchema = z.object({
  category: z.string()
});

type Params = {
  params: {
    id: string;
  };
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const body = await request.json();
    const { category } = updateSchema.parse(body);

    if (!isCategory(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const updated = await query(
      `UPDATE notes
       SET category = $1
       WHERE id = $2
       RETURNING id, text, category, confidence, tags, source, created_at`,
      [category, params.id]
    );

    if (!updated[0]) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note: updated[0] });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update note", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}

