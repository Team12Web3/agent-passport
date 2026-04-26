"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  getContract,
  prepareContractCall,
  waitForReceipt,
  type ThirdwebClient,
} from "thirdweb";
import { avalancheFuji } from "thirdweb/chains";
import { useSendTransaction, useSwitchActiveWalletChain } from "thirdweb/react";

import {
  generateAgent,
  saveAgent,
  type AgentRecord,
} from "@/lib/agentKeys";
import { parsePassportMintedFromLogs } from "@/lib/agentPassport";
import { shortenAddress } from "@/lib/utils";
import { CreateAgentProgress, type CreateStep } from "./CreateAgentProgress";

type Props = {
  open: boolean;
  onClose: () => void;
  client: ThirdwebClient;
  contractAddress: string;
  ownerAddress: string;
  /** Called after a successful mint so the dashboard can refresh its grid. */
  onCreated: (record: AgentRecord) => void;
};

const TOOL_OPTIONS: { value: "scraper" | "summarizer" | "logger"; label: string }[] = [
  { value: "scraper", label: "Scraper" },
  { value: "summarizer", label: "Summarizer" },
  { value: "logger", label: "Logger" },
];

const INITIAL_STEPS: CreateStep[] = [
  { id: "wallet", label: "Generating fresh agent EOA", status: "pending" },
  { id: "mint", label: "Confirming mint in your wallet", status: "pending" },
  { id: "confirm", label: "Waiting for Avalanche Fuji confirmation", status: "pending" },
];

/**
 * Create-agent modal driving the existing in-browser (Option B) mint flow.
 *
 * The dashboard's `Create` tab is still the source of truth for advanced
 * setup (deploy contract, backups, etc). This dialog is the lightweight
 * one-click surface the spec asks for and is reachable from `+ New Agent`
 * or `?onboard=1` in the URL.
 */
export function CreateAgentDialog({
  open,
  onClose,
  client,
  contractAddress,
  ownerAddress,
  onCreated,
}: Props) {
  const switchChain = useSwitchActiveWalletChain();
  const { mutateAsync: sendTx } = useSendTransaction({ payModal: false });

  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [tools, setTools] = useState<("scraper" | "summarizer" | "logger")[]>([
    "scraper",
  ]);
  const [steps, setSteps] = useState<CreateStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AgentRecord | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Reset transient state every time the dialog re-opens so a previous run
  // doesn't ghost into the next session.
  useEffect(() => {
    if (open) {
      setSteps(INITIAL_STEPS);
      setError(null);
      setCreated(null);
      setRunning(false);
      // Defer focus until after the dialog has actually painted.
      const t = window.setTimeout(() => closeButtonRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !running) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, running, onClose]);

  const canSubmit = useMemo(
    () =>
      !running &&
      name.trim().length > 0 &&
      purpose.trim().length > 0 &&
      tools.length > 0 &&
      contractAddress.startsWith("0x") &&
      contractAddress.length === 42,
    [running, name, purpose, tools, contractAddress],
  );

  const updateStep = useCallback(
    (id: string, patch: Partial<CreateStep>) =>
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    [],
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;

    setRunning(true);
    setError(null);
    setCreated(null);
    setSteps(INITIAL_STEPS);

    const trimmedName = name.trim();
    const label = trimmedName || `agent-${Date.now().toString(36)}`;

    try {
      // Step 1 — fresh EOA (purely client-side).
      updateStep("wallet", { status: "active" });
      const generated = generateAgent();
      updateStep("wallet", {
        status: "done",
        detail: shortenAddress(generated.address, 6, 6),
      });

      // Step 2 — mint via the user's connected wallet.
      updateStep("mint", { status: "active" });
      try {
        await switchChain(avalancheFuji);
      } catch {
        throw new Error(
          "Switch your wallet to Avalanche Fuji (43113) and try again.",
        );
      }

      const contract = getContract({
        address: contractAddress,
        chain: avalancheFuji,
        client,
      });

      const metadataURI = `data:application/json,${encodeURIComponent(
        JSON.stringify({
          name: trimmedName,
          purpose: purpose.trim(),
          tools,
          createdAt: new Date().toISOString(),
        }),
      )}`;

      const tx = prepareContractCall({
        contract,
        method:
          "function mintPassport(address agentWallet, string metadataURI) returns (uint256)",
        params: [generated.address, metadataURI],
      });

      const sent = await sendTx(tx);
      updateStep("mint", {
        status: "done",
        detail: shortenAddress(sent.transactionHash, 6, 6),
      });

      // Step 3 — wait for confirmation.
      updateStep("confirm", { status: "active" });
      const receipt = await waitForReceipt({
        client,
        chain: avalancheFuji,
        transactionHash: sent.transactionHash,
      });

      const minted = parsePassportMintedFromLogs(
        receipt.logs ?? [],
        contractAddress,
      );
      if (!minted) {
        throw new Error(
          "Mint succeeded but PassportMinted event was not found.",
        );
      }

      const record = saveAgent({
        passportId: minted.id.toString(),
        agentAddress: generated.address,
        privateKey: generated.privateKey,
        ownerAddress,
        label,
        mintTxHash: receipt.transactionHash,
      });

      updateStep("confirm", {
        status: "done",
        detail: `passport #${record.passportId}`,
      });

      setCreated(record);
      onCreated(record);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Mint failed or was rejected — you may need Fuji AVAX for gas.";
      setError(msg);
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.status === "active");
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status: "error" };
        return next;
      });
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-agent-dialog-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => {
          if (!running) onClose();
        }}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0b0c0f] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] px-5 py-4">
          <div>
            <div className="eyebrow">New agent</div>
            <h2
              id="create-agent-dialog-title"
              className="mt-1.5 text-[16px] font-semibold tracking-tight"
            >
              Mint an Agent Passport
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              Generates a fresh EOA in your browser and binds it to your
              wallet on Avalanche Fuji.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={running}
            className="btn btn-ghost focus-ring -mr-1 -mt-1 px-1.5 py-1 text-[18px] leading-none disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {created ? (
          <SuccessPanel
            record={created}
            onClose={onClose}
            onNew={() => {
              setCreated(null);
              setName("");
              setPurpose("");
              setTools(["scraper"]);
              setSteps(INITIAL_STEPS);
            }}
          />
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div>
              <label
                htmlFor="agent-name"
                className="block text-[11.5px] text-subtle mb-1.5"
              >
                Name
              </label>
              <input
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="research-agent"
                maxLength={40}
                required
                disabled={running}
                className="input focus-ring"
              />
            </div>

            <div>
              <label
                htmlFor="agent-purpose"
                className="block text-[11.5px] text-subtle mb-1.5"
              >
                Purpose
              </label>
              <textarea
                id="agent-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Browses RSS feeds nightly and posts a summary to Slack."
                rows={2}
                maxLength={200}
                required
                disabled={running}
                className="input focus-ring resize-none"
              />
            </div>

            <div>
              <div className="block text-[11.5px] text-subtle mb-1.5">
                Tools
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TOOL_OPTIONS.map((opt) => {
                  const checked = tools.includes(opt.value);
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      disabled={running}
                      onClick={() =>
                        setTools((prev) =>
                          prev.includes(opt.value)
                            ? prev.filter((t) => t !== opt.value)
                            : [...prev, opt.value],
                        )
                      }
                      className={[
                        "rounded-md px-2.5 py-1 text-[11.5px] transition focus-ring",
                        checked
                          ? "bg-white/[0.08] text-fg border border-white/15"
                          : "bg-white/[0.02] text-muted border border-white/[0.06] hover:text-fg hover:border-white/15",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {(running || steps.some((s) => s.status !== "pending")) && (
              <div>
                <div className="eyebrow mb-2">Progress</div>
                <CreateAgentProgress steps={steps} />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-rose-400/25 bg-rose-400/[0.06] px-3 py-2 text-[12px] text-rose-200">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={running}
                className="btn btn-ghost focus-ring text-[12px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn btn-primary focus-ring text-[12px]"
              >
                {running ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 rounded-full border-[1.5px] border-current border-r-transparent animate-spin" />
                    Working…
                  </>
                ) : (
                  "Create & mint"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SuccessPanel({
  record,
  onClose,
  onNew,
}: {
  record: AgentRecord;
  onClose: () => void;
  onNew: () => void;
}) {
  return (
    <div className="px-5 py-4 space-y-4">
      <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2.5 text-[12.5px] text-emerald-100">
        Passport <span className="font-mono">#{record.passportId}</span> minted
        for <span className="font-mono">{record.label}</span>.
      </div>

      <dl className="rounded-lg border border-white/[0.06] bg-black/30 p-3 text-[11.5px] space-y-1.5">
        <Row label="agent" value={record.agentAddress} />
        <Row
          label="tx"
          value={record.mintTxHash ?? "—"}
          link={
            record.mintTxHash
              ? `https://testnet.snowtrace.io/tx/${record.mintTxHash}`
              : undefined
          }
        />
      </dl>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onNew}
          className="btn btn-ghost focus-ring text-[12px]"
        >
          Mint another
        </button>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-primary focus-ring text-[12px]"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: string;
}) {
  const display = value.length > 22 ? shortenAddress(value, 8, 6) : value;
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="font-mono text-muted">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-fg"
          >
            {display}
          </a>
        ) : (
          display
        )}
      </dd>
    </div>
  );
}
