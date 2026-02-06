import { NextResponse } from "next/server";
import { z } from "zod";

import { listUserLabelsWithCounts, upsertUserLabel } from "@/lib/label-store";
import { requireCurrentUserId } from "@/lib/current-user";

const createLabelSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
});

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const labels = await listUserLabelsWithCounts(userId);
    return NextResponse.json({ labels });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load labels", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = createLabelSchema.parse(body);
    const label = await upsertUserLabel(userId, parsed.name, parsed.color);
    if (!label) {
      return NextResponse.json({ error: "Invalid label name" }, { status: 400 });
    }

    return NextResponse.json({ label }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create label", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}

