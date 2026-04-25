export const MOCK_AGENT_IDS = ["agent-alpha", "agent-beta", "agent-gamma", "agent-delta"];

export function mockProgressPercent(agentId: string): number {
  // Deterministic "random" 10..95 based on agentId
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) >>> 0;
  return 10 + (h % 86);
}

export function mockScore(agentId: string): number {
  // Deterministic score 0..1000
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 167 + agentId.charCodeAt(i)) >>> 0;
  return h % 1001;
}

export function mockOwner(agentId: string): string {
  // Fake but stable hex-like address for demos
  let h = 0n;
  for (let i = 0; i < agentId.length; i++) h = (h * 131n + BigInt(agentId.charCodeAt(i))) & ((1n << 160n) - 1n);
  const hex = h.toString(16).padStart(40, "0");
  return "0x" + hex;
}

