-- Nexus — Schéma base de données + Row Level Security
-- À exécuter dans Supabase → SQL Editor.
-- Chaque table est isolée par utilisateur via RLS (user_id = auth.uid()).

-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- Layout du dashboard modulaire (React Grid Layout) — un par utilisateur.
create table if not exists public.dashboard_layouts (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  layout      jsonb not null default '[]'::jsonb,
  widgets     jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Watchlist / favoris.
create table if not exists public.watchlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  symbol      text not null,
  asset_type  text not null default 'stock',
  created_at  timestamptz not null default now(),
  unique (user_id, symbol)
);

-- Compte paper trading — solde de cash, départ 100'000 CHF.
create table if not exists public.paper_accounts (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  cash_balance  numeric(18, 4) not null default 100000,
  currency      text not null default 'CHF',
  created_at    timestamptz not null default now()
);

-- Journal des trades paper (source de vérité ; positions et P&L dérivés).
create table if not exists public.paper_trades (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  symbol       text not null,
  asset_type   text not null default 'stock',
  side         text not null check (side in ('buy', 'sell')),
  quantity     numeric(18, 8) not null check (quantity > 0),
  price        numeric(18, 4) not null check (price >= 0),
  currency     text not null default 'CHF',
  executed_at  timestamptz not null default now(),
  note         text
);
create index if not exists paper_trades_user_idx on public.paper_trades (user_id, executed_at desc);

-- Conversations Nexus Coach.
create table if not exists public.coach_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'Nouvelle conversation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Messages d'une conversation Coach.
create table if not exists public.coach_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.coach_conversations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  created_at       timestamptz not null default now()
);
create index if not exists coach_messages_conv_idx on public.coach_messages (conversation_id, created_at);

-- Alertes personnalisées (VIX > seuil, variation favori, événement macro).
create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null,
  config      jsonb not null default '{}'::jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Préférences utilisateur.
create table if not exists public.user_preferences (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- =====================================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================================

alter table public.dashboard_layouts  enable row level security;
alter table public.watchlist           enable row level security;
alter table public.paper_accounts      enable row level security;
alter table public.paper_trades        enable row level security;
alter table public.coach_conversations enable row level security;
alter table public.coach_messages      enable row level security;
alter table public.alerts              enable row level security;
alter table public.user_preferences    enable row level security;

-- Helper: chaque table a une politique "owner" (SELECT/INSERT/UPDATE/DELETE
-- limités aux lignes où user_id = auth.uid()).
do $$
declare
  t text;
  tables text[] := array[
    'dashboard_layouts', 'watchlist', 'paper_accounts', 'paper_trades',
    'coach_conversations', 'coach_messages', 'alerts', 'user_preferences'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists owner_select on public.%I;', t);
    execute format('drop policy if exists owner_insert on public.%I;', t);
    execute format('drop policy if exists owner_update on public.%I;', t);
    execute format('drop policy if exists owner_delete on public.%I;', t);

    execute format(
      'create policy owner_select on public.%I for select using (auth.uid() = user_id);', t);
    execute format(
      'create policy owner_insert on public.%I for insert with check (auth.uid() = user_id);', t);
    execute format(
      'create policy owner_update on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format(
      'create policy owner_delete on public.%I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- =====================================================================
-- 3. SEED AUTOMATIQUE À L'INSCRIPTION
-- Crée le compte paper trading (100k CHF) et les préférences vides.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.paper_accounts (user_id) values (new.id)
    on conflict (user_id) do nothing;
  insert into public.user_preferences (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
