import "server-only";

import { randomUUID } from "node:crypto";

import { getSupabase, type AgentNonceRow } from "../db/supabase";

const AGENT_NONCES_SQL = `create table if not exists agent_nonces (
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
  with check (true);`;

function assertNonEmpty(label: string, value: string): void {
  if (!value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function rethrowWithMigrationHint(error: { message?: string; code?: string }): never {
  const relationMissing =
    error.code === "42P01" ||
    (typeof error.message === "string" &&
      error.message.toLowerCase().includes("agent_nonces"));

  if (relationMissing) {
    throw new Error(
      [
        "The Supabase table `agent_nonces` does not exist yet.",
        "Person 1 should run this SQL:",
        AGENT_NONCES_SQL,
      ].join("\n\n"),
    );
  }

  throw new Error(error.message ?? "Unexpected agent nonce error");
}

export async function issueAgentNonce(agentId: string): Promise<string> {
  assertNonEmpty("agentId", agentId);

  const nonce = randomUUID();
  const { error } = await getSupabase().from("agent_nonces").insert({
    agent_id: agentId,
    nonce,
  });

  if (error) {
    rethrowWithMigrationHint(error);
  }

  return nonce;
}

export async function isNonceUsed(
  agentId: string,
  nonce: string,
): Promise<boolean> {
  assertNonEmpty("agentId", agentId);
  assertNonEmpty("nonce", nonce);

  const { data, error } = await getSupabase()
    .from("agent_nonces")
    .select("used_at")
    .eq("agent_id", agentId)
    .eq("nonce", nonce)
    .maybeSingle<Pick<AgentNonceRow, "used_at">>();

  if (error) {
    rethrowWithMigrationHint(error);
  }

  return !!data?.used_at;
}

export async function markNonceUsed(
  agentId: string,
  nonce: string,
): Promise<boolean> {
  assertNonEmpty("agentId", agentId);
  assertNonEmpty("nonce", nonce);

  const { data, error } = await getSupabase()
    .from("agent_nonces")
    .update({ used_at: new Date().toISOString() })
    .eq("agent_id", agentId)
    .eq("nonce", nonce)
    .is("used_at", null)
    .select("agent_id")
    .maybeSingle<Pick<AgentNonceRow, "agent_id">>();

  if (error) {
    rethrowWithMigrationHint(error);
  }

  return !!data;
}

export function getAgentNoncesMigrationSql(): string {
  return AGENT_NONCES_SQL;
}
