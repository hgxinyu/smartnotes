import { NextResponse } from "next/server";

import { requireCurrentUserId } from "@/lib/current-user";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const todos = await query(
      `SELECT id, content, is_done, source_note_id, created_at
       FROM todos
       WHERE user_id = $1
       ORDER BY is_done ASC, created_at DESC
       LIMIT 200`,
      [userId]
    );
    return NextResponse.json({ todos });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load todos", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
