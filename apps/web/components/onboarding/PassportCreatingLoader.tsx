"use client";

export function PassportCreatingLoader({
  title = "Creating your passport",
  subtitle = "Provisioning wallet, funding, and minting on Fuji...",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-400/[0.06] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="relative h-8 w-8 shrink-0">
          <span className="absolute inset-0 rounded-full border border-cyan-300/40 animate-ping" />
          <span className="absolute inset-[5px] rounded-full border border-cyan-200/70 animate-spin" />
          <span className="absolute inset-[11px] rounded-full bg-cyan-200/90" />
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-cyan-100">{title}</p>
          <p className="text-[11.5px] text-cyan-100/80">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
