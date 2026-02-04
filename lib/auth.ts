import type { NextAuthOptions } from "next-auth";
import AppleProvider from "next-auth/providers/apple";
import GoogleProvider from "next-auth/providers/google";

import { query } from "@/lib/db";

const providers = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  );
}

if (process.env.APPLE_ID && process.env.APPLE_SECRET) {
  providers.push(
    AppleProvider({
      clientId: process.env.APPLE_ID,
      clientSecret: process.env.APPLE_SECRET
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/"
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

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

      await query(
        `INSERT INTO users (email, name, image_url, last_provider, last_sign_in_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             image_url = EXCLUDED.image_url,
             last_provider = EXCLUDED.last_provider,
             last_sign_in_at = NOW()`,
        [user.email, user.name ?? null, user.image ?? null, account?.provider ?? "unknown"]
      );

      return true;
    }
  }
};
