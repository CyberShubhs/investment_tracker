-- Investment Tracker schema
-- Run in Supabase SQL editor. Requires the auth schema (built-in).

create extension if not exists "pgcrypto";

-- Assets
create table if not exists public.assets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  type          text not null check (type in ('cash','crypto','stock','etf','property','vehicle','super','jewellery','business','other')),
  provider      text,
  symbol        text,
  quantity      numeric,
  avg_cost      numeric,
  current_value numeric not null default 0,
  currency      text not null default 'AUD',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists assets_user_idx on public.assets(user_id);

-- Liabilities
create table if not exists public.liabilities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  type             text not null check (type in ('mortgage','car_loan','credit_card','personal_loan','bnpl','hecs','family','other')),
  balance          numeric not null default 0,
  interest_rate    numeric,
  repayment_amount numeric,
  frequency        text check (frequency in ('weekly','fortnightly','monthly','quarterly','yearly')),
  linked_asset_id  uuid references public.assets(id) on delete set null,
  currency         text not null default 'AUD',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists liabilities_user_idx on public.liabilities(user_id);

-- Transactions
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  kind          text not null check (kind in ('buy','sell','deposit','withdrawal','dividend','repayment','fee','valuation')),
  asset_id      uuid references public.assets(id) on delete set null,
  liability_id  uuid references public.liabilities(id) on delete set null,
  amount        numeric not null default 0,
  quantity      numeric,
  price         numeric,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists tx_user_idx on public.transactions(user_id);
create index if not exists tx_date_idx on public.transactions(user_id, date desc);

-- Net worth snapshots
create table if not exists public.net_worth_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  date               timestamptz not null default now(),
  total_assets       numeric not null default 0,
  total_liabilities  numeric not null default 0,
  net_worth          numeric not null default 0,
  note               text
);
create index if not exists snap_user_idx on public.net_worth_snapshots(user_id, date desc);

-- Integrations
create table if not exists public.integrations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  provider    text not null,
  status      text not null default 'planned' check (status in ('planned','configured','active','disabled')),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists integ_user_idx on public.integrations(user_id);

-- Row Level Security: each row is only visible to its owner.
alter table public.assets               enable row level security;
alter table public.liabilities          enable row level security;
alter table public.transactions         enable row level security;
alter table public.net_worth_snapshots  enable row level security;
alter table public.integrations         enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['assets','liabilities','transactions','net_worth_snapshots','integrations']) loop
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
