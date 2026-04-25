import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export type AgentRow = {
  id: string;
  user_id: string;
  name: string;
  purpose: string;
  tools: string[];
  passport_id: string | null;
  agent_wallet_address: string;
  encrypted_private_key: string;
  mint_tx_hash: string | null;
  created_at: string;
};

export type ActionRunRow = {
  id: string;
  agent_id: string;
  url: string;
  prompt: string;
  result: { summary?: string; actionsCount?: number; feeUsd?: number } | null;
  actions: unknown[] | null;
  actions_root: string | null;
  log_tx_hash: string | null;
  fee_amount: string | null;
  status: "pending" | "done" | "error";
  created_at: string;
};

export type UserRow = {
  id: string;
  thirdweb_id: string;
  email: string | null;
  wallet_address: string | null;
  created_at: string;
};
