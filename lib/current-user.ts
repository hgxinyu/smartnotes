import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

async function ensureUsersTable() {
  await query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await query(
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      image_url TEXT,
      last_provider TEXT,
      last_sign_in_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
}

export async function requireCurrentUserId() {
  await ensureUsersTable();

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  const bypassEnabled = process.env.DEV_AUTH_BYPASS === "true";
  const fallbackEmail = process.env.DEV_AUTH_EMAIL || "local@smartnotes.dev";

  if (!email && !bypassEnabled) return null;
  const effectiveEmail = email ?? fallbackEmail;
  const effectiveName = session?.user?.name ?? (bypassEnabled ? "Local Dev User" : null);
  const effectiveImage = session?.user?.image ?? null;
  const provider = email ? "session" : "dev-bypass";

  const rows = await query<{ id: string }>(
    `INSERT INTO users (email, name, image_url, last_provider, last_sign_in_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         image_url = EXCLUDED.image_url,
         last_provider = EXCLUDED.last_provider,
         last_sign_in_at = NOW()
     RETURNING id`,
    [effectiveEmail, effectiveName, effectiveImage, provider]
  );

  return rows[0]?.id ?? null;
}
