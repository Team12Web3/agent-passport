"use client";
import { BrowserChrome } from "./BrowserChrome";
import { AgentTerminal } from "./AgentTerminal";
import type { AgentEvent } from "@/lib/events";
import type { RunStatus } from "@/hooks/useAgentRun";

type Props = {
  url: string;
  events: AgentEvent[];
  status: RunStatus;
  iframeOverlay?: React.ReactNode;
};

export function SplitView({ url, events, status, iframeOverlay }: Props) {
  return (
    <div className="flex gap-4">
      {/* Left 60% — browser */}
      <div className="w-3/5 min-w-0">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Target
        </p>
        <BrowserChrome url={url} overlay={iframeOverlay} />
      </div>

      {/* Right 40% — terminal */}
      <div className="w-2/5 min-w-0">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Agent Log
        </p>
        <AgentTerminal events={events} status={status} />
      </div>
    </div>
  );
}
