# Investment Tracker

Personal net-worth + cash-flow tracker PWA. Tracks assets (crypto, shares, property, gold, computers…), liabilities, income vs expenses, with live pricing and snapshots over time.

## Features

- **Net worth dashboard** — assets, liabilities, allocation, holdings by provider, history snapshots
- **CoinSpot live sync** — read-only API pulls crypto balances + AUD values (server-side, key never in browser)
- **CommSec holdings** — import the holdings CSV; positions revalued with live ASX prices (Yahoo)
- **Live prices** — ASX equities (Yahoo), crypto (CoinGecko), gold spot via PAXG proxy; stale-price indicators
- **Physical gold** — tracked by weight (grams) and purity, revalued at spot
- **Equipment** — computers etc. with straight-line depreciation estimates
- **Cash flow** — income/expense ledger with categories, recurring rules (salary, rent…), monthly analytics, savings rate, 12-month trend
- **Cloud sync** — Supabase auth + storage with localStorage cache for instant load and offline viewing; or pure local mode with no setup

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS (dark theme) + Recharts
- Supabase (auth + Postgres with RLS) — optional
- PWA: manifest + service worker

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The app runs in **local mode** out of the box — data is stored in your browser. Use `Integrations → Load demo data` to preview the dashboard.

## Cloud mode (Supabase)

1. Create a Supabase project, then run `supabase/schema.sql` followed by `supabase/schema_v2.sql` in the SQL editor.
2. In Authentication → Settings, **disable new sign-ups**, then add your single user (email + password) under Users.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Start the app, sign in. If you previously used local mode, `Integrations → Storage` offers a one-click import of your existing data.

## CoinSpot sync

1. CoinSpot → Profile → API → generate a **read-only** key.
2. Set `COINSPOT_API_KEY` and `COINSPOT_API_SECRET` in `.env.local` (and in Vercel for production). These are server-only.
3. `Integrations → Sync CoinSpot` (also available from the dashboard).

## Deploy

Builds on Vercel with zero config. Set the four env vars in the Vercel dashboard.

## Security

- Read-only integration design only. Never request withdrawal/trading permissions.
- No secrets in the frontend; CoinSpot calls are signed server-side. API routes require a Supabase bearer token.
- Supabase RLS ensures per-user isolation.
