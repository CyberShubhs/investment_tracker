# Investment Tracker

Personal net-worth tracker PWA. Tracks assets, liabilities, investments, crypto, stocks, property, cars and savings, with snapshots over time.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS (premium dark theme)
- Recharts
- PWA: manifest + service worker
- Local-first storage in the browser; optional Supabase sync (schema included)

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The app runs in **local mode** out of the box — data is stored in your browser. Use `Integrations → Load demo data` to preview the dashboard.

## Optional: Supabase

Copy `.env.example` to `.env.local` and set:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Run the schema in `supabase/schema.sql` (Supabase SQL editor). RLS is enabled so each user only sees their own rows.

## Deploy

The project builds on Vercel with zero config. Add the env vars in the Vercel dashboard if you want Supabase sync.

## Security

- Read-only integration design only. Never request withdrawal/trading permissions.
- No secrets in the frontend. Use environment variables.
- Supabase RLS ensures per-user isolation.
