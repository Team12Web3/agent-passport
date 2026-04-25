import "server-only";
import { json, unauthorized } from "../../_lib/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/supabase";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  const supabase = getSupabase();

  const { data: rows, error } = await supabase
    .from("agents")
    .select(
      "id, name, purpose, tools, passport_id, agent_wallet_address, created_at, action_runs(count)",
    )
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[agents/list]", error);
    return json({ error: "db_query_failed" }, { status: 500 });
  }

  const agents = (rows ?? []).map((r: Record<string, unknown>) => ({
    agentId:       r.id as string,
    name:          r.name as string,
    purpose:       r.purpose as string,
    tools:         (r.tools as string[]) ?? [],
    passportId:    (r.passport_id as string) ?? "",
    walletAddress: r.agent_wallet_address as `0x${string}`,
    actionCount:
      Array.isArray(r.action_runs) && r.action_runs.length > 0
        ? Number((r.action_runs[0] as { count?: number })?.count ?? 0)
        : 0,
    createdAt: r.created_at as string,
  }));

  return json({ agents });
}
