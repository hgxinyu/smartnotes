# SmartNotes

SmartNotes is a notes app that auto-categorizes daily thoughts into useful lists (for example, grocery, tasks, reminders, ideas).

Current MVP features:
- Two backend record types: notes and to-dos
- Auto-route user input into notes vs to-dos
- Image uploads are saved to notes
- AI-generated labels for both notes and to-dos
- Manual label tagging on notes and to-dos
- Dedicated label management page with label explorer (pick a label and view all linked notes/todos)
- Social auth registration/sign-in with Google and Apple
- Notes, todos, and labels are private per signed-in user

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

3. Create tables in Neon by running `db/schema.sql`.
For existing databases, apply the latest bottom migration blocks (auth/user-scoping and labels).

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
