export function shortenAddress(addr: string, left = 6, right = 4) {
  if (!addr) return "";
  if (addr.length <= left + right + 2) return addr;
  return `${addr.slice(0, left + 2)}…${addr.slice(-right)}`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/// Deterministic 10-95% value derived from any seed string. Used to give each
/// agent a stable but visually-varied "activity" bar so the dashboard feels
/// alive without depending on (currently unmodeled) usage data.
export function deterministicPercent(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 10 + (h % 86);
}
