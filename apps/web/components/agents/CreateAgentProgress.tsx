"use client";

export type CreateStepStatus = "pending" | "active" | "done" | "error";

export type CreateStep = {
  id: string;
  label: string;
  status: CreateStepStatus;
  /** Optional secondary text — typically a tx hash or short description. */
  detail?: string;
};

type Props = {
  steps: CreateStep[];
};

/**
 * Vertical 3-step progress strip used inside CreateAgentDialog. The
 * presentational component is decoupled from the actual minting flow so
 * the dashboard can drive it from its existing wallet-based logic.
 */
export function CreateAgentProgress({ steps }: Props) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, idx) => (
        <li
          key={step.id}
          className="flex items-start gap-3 rounded-md border border-white/[0.05] bg-black/30 px-3 py-2.5"
        >
          <StepIcon status={step.status} index={idx + 1} />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] text-fg leading-tight">
              {step.label}
            </div>
            {step.detail && (
              <div className="mt-0.5 font-mono text-[11px] text-faint break-all">
                {step.detail}
              </div>
            )}
          </div>
          <StatusBadge status={step.status} />
        </li>
      ))}
    </ol>
  );
}

function StepIcon({
  status,
  index,
}: {
  status: CreateStepStatus;
  index: number;
}) {
  if (status === "done") {
    return (
      <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-400/15 text-emerald-300 flex items-center justify-center">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden
        >
          <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-white/15 flex items-center justify-center text-emerald-300">
        <span className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-current border-r-transparent animate-spin" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-rose-400/15 text-rose-300 flex items-center justify-center text-[10px] font-bold">
        !
      </div>
    );
  }
  return (
    <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-white/[0.08] text-faint flex items-center justify-center text-[10px] font-mono">
      {index}
    </div>
  );
}

function StatusBadge({ status }: { status: CreateStepStatus }) {
  if (status === "pending") return null;
  const styles =
    status === "done"
      ? "bg-emerald-400/15 text-emerald-300"
      : status === "error"
        ? "bg-rose-400/15 text-rose-300"
        : "bg-zinc-700/30 text-zinc-200";
  const label =
    status === "done" ? "done" : status === "error" ? "fail" : "running";
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${styles}`}
    >
      {label}
    </span>
  );
}
