import "server-only";
import { json, unauthorized } from "../../_lib/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/supabase";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  const supabase = getSupabase();

  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select(
      "id, name, purpose, tools, passport_id, agent_wallet_address, created_at, mint_tx_hash, user_id",
    )
    .eq("id", params.id)
    .single();

  if (agentErr || !agent) {
    return json({ error: "not_found" }, { status: 404 });
  }
  if ((agent as { user_id: string }).user_id !== session.user.id) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const { data: runs, error: runErr } = await supabase
    .from("action_runs")
    .select(
      "id, url, prompt, status, result, log_tx_hash, fee_amount, created_at",
    )
    .eq("agent_id", params.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (runErr) {
    console.error("[agents/:id] runs query", runErr);
    return json({ error: "db_query_failed" }, { status: 500 });
  }

  const a = agent as Record<string, unknown>;
  return json({
    agent: {
      agentId:       a.id as string,
      name:          a.name as string,
      purpose:       a.purpose as string,
      tools:         (a.tools as string[]) ?? [],
      passportId:    (a.passport_id as string) ?? "",
      walletAddress: a.agent_wallet_address as `0x${string}`,
      createdAt:     a.created_at as string,
      mintTxHash:    (a.mint_tx_hash as `0x${string}`) ?? null,
    },
    runs: (runs ?? []).map((r: Record<string, unknown>) => ({
      id:           r.id as string,
      url:          r.url as string,
      prompt:       r.prompt as string,
      status:       r.status as "pending" | "done" | "error",
      summary:      ((r.result as { summary?: string } | null) ?? {}).summary,
      actionsCount:
        ((r.result as { actionsCount?: number } | null) ?? {}).actionsCount ?? 0,
      feeUsd:       ((r.result as { feeUsd?: number } | null) ?? {}).feeUsd ?? 0,
      logTxHash:    (r.log_tx_hash as `0x${string}` | null) ?? undefined,
      createdAt:    r.created_at as string,
    })),
  });
}
