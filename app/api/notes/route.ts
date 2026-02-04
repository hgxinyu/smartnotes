import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeAndCategorize } from "@/lib/categorize";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { query } from "@/lib/db";
import { extractTodoItems } from "@/lib/todos";

const createNoteSchema = z
  .object({
    text: z.string().max(4000).default(""),
    textHtml: z.string().max(20000).optional(),
    imageData: z.string().max(3_000_000).optional()
  })
  .refine((value) => value.text.trim().length > 0 || Boolean(value.imageData), {
    message: "Either text or an image is required"
  });

function sanitizeHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

export async function GET() {
  try {
    const notes = await query(
      `SELECT n.id, n.text, n.text_html, n.image_data, n.category_slug, n.confidence, n.tags, n.source, n.created_at, c.name AS category_name, c.label AS category_label, c.color AS category_color
       FROM notes n
       JOIN categories c ON c.slug = n.category_slug
       ORDER BY n.created_at DESC
       LIMIT 300`
    );

    return NextResponse.json({ notes });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load notes", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, textHtml, imageData } = createNoteSchema.parse(body);
    const safeHtml = textHtml ? sanitizeHtml(textHtml) : "";
    const normalizedText = text.trim();

    for (const category of DEFAULT_CATEGORIES) {
      await query(
        `INSERT INTO categories (slug, name, label, color)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO NOTHING`,
        [category.slug, category.name, category.label, category.color]
      );
    }

    const categories = await query<{ slug: string; name: string; label: string; color: string }>(
      "SELECT slug, name, label, color FROM categories"
    );
    const analyzed = normalizedText ? await analyzeAndCategorize(normalizedText, categories) : [];
    const entries = analyzed.filter((entry) => entry.text.trim().length > 0);
    const safeEntries = entries.length > 0 ? entries : [{ text: normalizedText || "Image note", categorySlug: "uncategorized", confidence: 0.2, tags: [], source: "rules" as const }];

    const created = [];
    for (const entry of safeEntries) {
      const inserted = await query(
        `INSERT INTO notes (text, text_html, image_data, category_slug, confidence, tags, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, text, text_html, image_data, category_slug, confidence, tags, source, created_at`,
        [entry.text, safeHtml, imageData ?? null, entry.categorySlug, entry.confidence, entry.tags, entry.source]
      );
      created.push(inserted[0]);
    }

    const ids = created.map((item) => item.id);

    for (const note of created) {
      const todos = await extractTodoItems(String(note.text ?? ""));
      for (const todo of todos) {
        await query(
          `INSERT INTO todos (content, source_note_id)
           VALUES ($1, $2)`,
          [todo, note.id]
        );
      }
    }

    const notes = await query(
      `SELECT n.id, n.text, n.text_html, n.image_data, n.category_slug, n.confidence, n.tags, n.source, n.created_at, c.name AS category_name, c.label AS category_label, c.color AS category_color
       FROM notes n
       JOIN categories c ON c.slug = n.category_slug
       WHERE n.id = ANY($1::uuid[])
       ORDER BY n.created_at DESC`,
      [ids]
    );

    const todoItems = await query(
      `SELECT id, content, is_done, source_note_id, created_at
       FROM todos
       ORDER BY is_done ASC, created_at DESC
       LIMIT 200`
    );

    return NextResponse.json({ notes, todos: todoItems }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create note", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
