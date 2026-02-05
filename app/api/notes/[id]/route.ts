import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCurrentUserId } from "@/lib/current-user";
import { query } from "@/lib/db";

const updateSchema = z.object({
  categorySlug: z.string().min(1)
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

    const body = await request.json();
    const { categorySlug } = updateSchema.parse(body);

    const category = await query("SELECT slug FROM categories WHERE slug = $1", [categorySlug]);
    if (!category[0]) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const updated = await query(
      `UPDATE notes
       SET category_slug = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, text, text_html, image_data, category_slug, confidence, tags, source, created_at`,
      [categorySlug, params.id, userId]
    );

    if (!updated[0]) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const withCategory = await query(
      `SELECT n.id, n.text, n.text_html, n.image_data, n.category_slug, n.confidence, n.tags, n.source, n.created_at, c.name AS category_name, c.label AS category_label, c.color AS category_color
       FROM notes n
       JOIN categories c ON c.slug = n.category_slug
       WHERE n.id = $1 AND n.user_id = $2`,
      [updated[0].id, userId]
    );

    return NextResponse.json({ note: withCategory[0] });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update note", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
