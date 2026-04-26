"use client";

type Props = {
  hasContract: boolean;
  onCreate?: () => void;
};

export function EmptyState({ hasContract, onCreate }: Props) {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-muted">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </div>
      <div className="mt-4 text-[14px] text-fg font-medium">
        {hasContract ? "Mint your first passport" : "Deploy the contract to begin"}
      </div>
      <div className="mt-1 text-[12.5px] text-muted">
        {hasContract
          ? "A fresh agent wallet is generated in your browser and bound to your owner address on chain."
          : "One-time deploy to Avalanche Fuji — costs a fraction of a cent in test AVAX."}
      </div>
      {onCreate && hasContract && (
        <button
          type="button"
          onClick={onCreate}
          className="btn btn-primary focus-ring mt-5 mx-auto"
        >
          Create your first agent
        </button>
      )}
    </div>
  );
}
