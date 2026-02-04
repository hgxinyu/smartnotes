import { NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_CATEGORIES, slugifyCategoryName } from "@/lib/categories";
import { query } from "@/lib/db";

const createCategorySchema = z.object({
  name: z.string().min(2).max(40),
  label: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#475569")
});

async function ensureDefaults() {
  for (const category of DEFAULT_CATEGORIES) {
    await query(
      `INSERT INTO categories (slug, name, label, color)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO NOTHING`,
      [category.slug, category.name, category.label, category.color]
    );
  }
}

export async function GET() {
  try {
    await ensureDefaults();
    const categories = await query(
      "SELECT slug, name, label, color FROM categories ORDER BY CASE WHEN slug = 'uncategorized' THEN 1 ELSE 0 END, label ASC, name ASC"
    );
    return NextResponse.json({ categories });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load categories", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, label, color } = createCategorySchema.parse(body);
    const slug = slugifyCategoryName(name);

    if (!slug || slug === "uncategorized") {
      return NextResponse.json({ error: "Invalid category name" }, { status: 400 });
    }

    const inserted = await query(
      `INSERT INTO categories (slug, name, label, color)
       VALUES ($1, $2, $3, $4)
       RETURNING slug, name, label, color`,
      [slug, name.trim(), label.trim(), color]
    );

    return NextResponse.json({ category: inserted[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create category", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
