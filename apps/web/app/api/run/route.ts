import "server-only";
import { z } from "zod";
import { json, unauthorized, validationError } from "../_lib/responses";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/supabase";
import {
  runAgentTask,
  BlockedError,
  type AgentEvent,
} from "@/lib/agent/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  agentId:      z.string().uuid(),
  url:          z.string().url().refine((u) => u.startsWith("http"), "must be http(s)"),
  prompt:       z.string().min(1).max(2000),
  withPassport: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) return validationError(err);
    return json({ error: "invalid_json" }, { status: 400 });
  }

  // Confirm ownership before opening the stream
  const supabase = getSupabase();
  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, user_id")
    .eq("id", body.agentId)
    .single();
  if (error || !agent) return json({ error: "not_found" }, { status: 404 });
  if ((agent as { user_id: string }).user_id !== session.user.id) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: AgentEvent) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await runAgentTask(
          {
            agentId:      body.agentId,
            url:          body.url,
            prompt:       body.prompt,
            withPassport: body.withPassport ?? true,
          },
          send,
        );
      } catch (err) {
        // Spec: stream MUST end with `done` or `error`. The `blocked` path
        // already surfaced its own event; we still need a terminal `error`
        // so consumers don't have to special-case stream-close detection.
        const message =
          err instanceof BlockedError
            ? "blocked by trust verification"
            : err instanceof Error
              ? err.message
              : String(err);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
