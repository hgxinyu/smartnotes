import { NextResponse } from "next/server";
import { z } from "zod";

import { query } from "@/lib/db";

const updateCategorySchema = z.object({
  name: z.string().min(2).max(40),
  label: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

type Params = {
  params: {
    slug: string;
  };
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    if (params.slug === "uncategorized") {
      return NextResponse.json({ error: "Cannot edit uncategorized" }, { status: 400 });
    }

    const body = await request.json();
    const { name, label, color } = updateCategorySchema.parse(body);

    const rows = await query(
      `UPDATE categories
       SET name = $1, label = $2, color = $3
       WHERE slug = $4
       RETURNING slug, name, label, color`,
      [name.trim(), label.trim(), color, params.slug]
    );

    if (!rows[0]) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ category: rows[0] });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update category", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}

