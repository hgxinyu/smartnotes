import { NextResponse } from "next/server";
import { z } from "zod";

import { categorizeNote } from "@/lib/categorize";
import { query } from "@/lib/db";

const createNoteSchema = z.object({
  text: z.string().min(1).max(1000)
});

export async function GET() {
  try {
    const notes = await query(
      "SELECT id, text, category, confidence, tags, source, created_at FROM notes ORDER BY created_at DESC LIMIT 200"
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
    const { text } = createNoteSchema.parse(body);
    const categorized = await categorizeNote(text);

    const inserted = await query(
      `INSERT INTO notes (text, category, confidence, tags, source)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, text, category, confidence, tags, source, created_at`,
      [text, categorized.category, categorized.confidence, categorized.tags, categorized.source]
    );

    return NextResponse.json({ note: inserted[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create note", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}

