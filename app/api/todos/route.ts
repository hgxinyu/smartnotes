import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export async function GET() {
  try {
    const todos = await query(
      `SELECT id, content, is_done, source_note_id, created_at
       FROM todos
       ORDER BY is_done ASC, created_at DESC
       LIMIT 200`
    );
    return NextResponse.json({ todos });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load todos", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

