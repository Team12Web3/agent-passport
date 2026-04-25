-- 01_init.sql — run once in Supabase SQL editor.
-- RLS is enabled but deliberately permissive: server-only routes use the
-- service-role key, which bypasses RLS. Browser clients should never hit
-- these tables directly.

create extension if not exists pgcrypto;

create table if not exists users (
  id              uuid primary key default gen_random_uuid(),
  thirdweb_id     text unique not null,
  email           text,
  wallet_address  text,
  created_at      timestamptz not null default now()
);

create table if not exists agents (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references users(id) on delete cascade,
  name                   text not null,
  purpose                text not null,
  tools                  jsonb not null default '[]'::jsonb,
  passport_id            text,
  agent_wallet_address   text not null,
  encrypted_private_key  text not null,
  mint_tx_hash           text,
  created_at             timestamptz not null default now()
);

create table if not exists action_runs (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references agents(id) on delete cascade,
  url          text not null,
  prompt       text not null,
  result       jsonb,
  actions      jsonb,
  actions_root text,
  log_tx_hash  text,
  fee_amount   text,
  status       text not null default 'pending',
  created_at   timestamptz not null default now()
);

create index if not exists agents_user_id_idx
  on agents (user_id);

create index if not exists action_runs_agent_id_created_idx
  on action_runs (agent_id, created_at desc);

alter table users        enable row level security;
alter table agents       enable row level security;
alter table action_runs  enable row level security;

-- Permissive policies — service role bypasses these anyway.
drop policy if exists users_all on users;
drop policy if exists agents_all on agents;
drop policy if exists runs_all on action_runs;

create policy users_all  on users        for all using (true) with check (true);
create policy agents_all on agents       for all using (true) with check (true);
create policy runs_all   on action_runs  for all using (true) with check (true);
