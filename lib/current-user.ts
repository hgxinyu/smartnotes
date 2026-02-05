import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export async function requireCurrentUserId() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;

  const rows = await query<{ id: string }>(
    `INSERT INTO users (email, name, image_url, last_provider, last_sign_in_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         image_url = EXCLUDED.image_url,
         last_sign_in_at = NOW()
     RETURNING id`,
    [email, session.user?.name ?? null, session.user?.image ?? null, "session"]
  );

  return rows[0]?.id ?? null;
}
