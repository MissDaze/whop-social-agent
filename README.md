# Whop Social Agent

An automation agent for Whop creators that monitors social platforms for
relevant conversations and product opportunities, generates on-brand replies
and posts, and publishes them — with a dashboard to review activity and logs.

Core capabilities (see `src/app/api/`):

- Scheduled monitoring of comments/mentions (`comments/monitor`, `cron`)
- AI-generated replies and posts (`generate`, `posts/publish`, `comments/publish`)
- Opportunity discovery and publishing (`opportunities/hunt`, `opportunities/publish`)
- Whop product creation (`products/create`)
- Media handling, activity logs, and user/auth management

## Tech stack

- Next.js 16 + React 19 + TypeScript
- Prisma ORM
- NextAuth for authentication
- OpenAI API for content generation
- node-cron for scheduled jobs
- Deploy target: Nixpacks-compatible host (see `nixpacks.toml`)

## Setup

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Configure required environment variables (Whop credentials, OpenAI key,
database URL, auth secrets) before running.

## Scripts

- `npm run dev` — start the local dev server
- `npm run build` — production build
- `npm start` — run the production build
- `npm run lint` — run ESLint
