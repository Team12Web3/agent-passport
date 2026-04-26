"use server";
import { createStreamableValue } from "ai/rsc";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/supabase";
import {
  runAgentTask,
  BlockedError,
  type AgentEvent,
} from "@/lib/agent/runtime";

export async function runAgentAction(input: {
  agentId: string;
  url: string;
  prompt: string;
  withPassport: boolean;
}) {
  const session = await getSessionUser();
  if (!session) throw new Error("unauthorized");

  const supabase = getSupabase();
  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, user_id")
    .eq("id", input.agentId)
    .single();
  if (error || !agent) throw new Error("not_found");
  if ((agent as { user_id: string }).user_id !== session.user.id)
    throw new Error("forbidden");

  const stream = createStreamableValue<AgentEvent>();

  (async () => {
    try {
      await runAgentTask(input, (event) => stream.update(event));
    } catch (err) {
      const message =
        err instanceof BlockedError
          ? "blocked by trust verification"
          : err instanceof Error
            ? err.message
            : String(err);
      stream.update({ type: "error", message });
    } finally {
      stream.done();
    }
  })();

  return stream.value;
}
