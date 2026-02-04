# SmartNotes

SmartNotes is a notes app that auto-categorizes daily thoughts into useful lists (for example, grocery, tasks, reminders, ideas).

Current MVP features:
- Auto-categorize notes with rules + AI fallback
- Split one input into multiple notes when different intents are detected
- Create custom categories with labels and colors
- Manually re-assign notes to another category
- Rich text input, image attachments, and created timestamp in note cards
- AI-generated to-do items extracted from notes (example: "need eggs" -> "Buy eggs")
- Social auth registration/sign-in with Google and Apple

## Stack

- Next.js (App Router)
- Netlify deployment
- Neon Postgres
- Optional AI categorization fallback (OpenAI-compatible APIs, including DeepSeek)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template:

```bash
cp .env.example .env.local
```

3. Create tables in Neon by running `db/schema.sql` (for existing DBs, run only the latest manual migration block at the bottom).

4. Start locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

- `DATABASE_URL`: Neon Postgres connection string
- `OPENAI_API_KEY`: Optional, enables model fallback for low-confidence notes
- `OPENAI_MODEL`: Optional, defaults to `gpt-4.1-mini`
- `OPENAI_BASE_URL`: Optional, set for OpenAI-compatible providers (example: `https://api.deepseek.com`)
- `NEXTAUTH_URL`: App URL (local: `http://localhost:3000`)
- `NEXTAUTH_SECRET`: Random secret used by NextAuth JWT/session encryption
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials
- `APPLE_ID` / `APPLE_SECRET`: Apple OAuth credentials

## Netlify

This repo includes `netlify.toml` with the official Next.js runtime plugin. Add the same environment variables in Netlify site settings before deployment.
