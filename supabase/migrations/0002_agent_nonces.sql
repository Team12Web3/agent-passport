create table if not exists agent_nonces (
  agent_id   uuid not null references agents(id) on delete cascade,
  nonce      text not null,
  issued_at  timestamptz not null default now(),
  used_at    timestamptz,
  primary key (agent_id, nonce)
);

create index if not exists agent_nonces_agent_id_issued_idx
  on agent_nonces (agent_id, issued_at desc);

alter table agent_nonces enable row level security;

drop policy if exists agent_nonces_all on agent_nonces;

create policy agent_nonces_all
  on agent_nonces
  for all
  using (true)
  with check (true);
