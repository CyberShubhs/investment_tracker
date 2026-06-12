-- Investment Tracker schema v2 (additive).
-- Run AFTER schema.sql in the Supabase SQL editor.

-- Widen asset types: metal (gold etc.) + equipment (computers etc.)
alter table public.assets drop constraint if exists assets_type_check;
alter table public.assets add constraint assets_type_check check (type in
  ('cash','crypto','stock','etf','property','vehicle','super','jewellery',
   'metal','equipment','business','other'));

-- New asset columns: metal weight, depreciation inputs, pricing metadata, sync key
alter table public.assets
  add column if not exists weight_grams       numeric,
  add column if not exists purity             numeric,
  add column if not exists purchase_price     numeric,
  add column if not exists purchase_date      date,
  add column if not exists depreciation_years numeric,
  add column if not exists salvage_value      numeric,
  add column if not exists price_source       text,
  add column if not exists last_priced_at     timestamptz,
  add column if not exists external_key       text;

create unique index if not exists assets_external_key_uq
  on public.assets(user_id, external_key) where external_key is not null;

-- Cash flow: categories
create table if not exists public.cashflow_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  direction   text not null check (direction in ('income','expense')),
  created_at  timestamptz not null default now(),
  unique (user_id, direction, name)
);
create index if not exists cfcat_user_idx on public.cashflow_categories(user_id);

-- Cash flow: recurring rules
create table if not exists public.recurring_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  direction   text not null check (direction in ('income','expense')),
  amount      numeric not null,
  category_id uuid references public.cashflow_categories(id) on delete set null,
  frequency   text not null check (frequency in ('weekly','fortnightly','monthly','quarterly','yearly')),
  start_date  date not null,
  end_date    date,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists rrule_user_idx on public.recurring_rules(user_id);

-- Cash flow: entries
-- unique (user_id, recurring_rule_id, date) keeps recurring materialization
-- idempotent across devices; NULL rule ids (manual entries) are unaffected.
create table if not exists public.cashflow_entries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  date              date not null,
  direction         text not null check (direction in ('income','expense')),
  amount            numeric not null,
  category_id       uuid references public.cashflow_categories(id) on delete set null,
  notes             text,
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (user_id, recurring_rule_id, date)
);
create index if not exists cf_user_date_idx on public.cashflow_entries(user_id, date desc);

-- RLS for the new tables (same four-policy pattern as schema.sql)
alter table public.cashflow_categories enable row level security;
alter table public.recurring_rules     enable row level security;
alter table public.cashflow_entries    enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['cashflow_categories','recurring_rules','cashflow_entries']) loop
    execute format('drop policy if exists "select own" on public.%I', t);
    execute format('drop policy if exists "insert own" on public.%I', t);
    execute format('drop policy if exists "update own" on public.%I', t);
    execute format('drop policy if exists "delete own" on public.%I', t);

    execute format('create policy "select own" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "insert own" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "update own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "delete own" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;
