// Client-side agent key + passport registry. Each "agent" gets a fresh EOA
// generated in the browser and persisted in localStorage. Keys never leave the
// browser; users can also download a JSON backup.
//
// Storage shape (per current owner address):
//   key:   `agent_passport.agents.<ownerLower>`
//   value: AgentRecord[]

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const AGENTS_KEY_PREFIX = "agent_passport.agents.";
const CONTRACT_KEY = "agent_passport.contractAddress";
const SCHEMA_VERSION = 1;

export type AgentRecord = {
  /// uint256 passport id (as a decimal string for JSON safety).
  passportId: string;
  /// EOA address of the agent (== `agentWallet` on-chain).
  agentAddress: string;
  /// 0x-prefixed 32-byte private key. Present only for legacy browser-managed
  /// agents; backend-managed agents keep this encrypted server-side.
  privateKey?: `0x${string}`;
  /// Owner address that minted this passport (lowercase).
  ownerAddress: string;
  /// Display label, also written into the passport's metadataURI.
  label: string;
  /// Mint tx hash for receipt linking.
  mintTxHash?: string;
  /// ISO timestamp.
  createdAt: string;
  /// Schema versioning for future migrations.
  v: number;
};

export type GeneratedAgent = {
  privateKey: `0x${string}`;
  address: `0x${string}`;
};

/// Generate a fresh, unfunded agent EOA in the browser.
export function generateAgent(): GeneratedAgent {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function keyFor(owner: string) {
  return `${AGENTS_KEY_PREFIX}${owner.toLowerCase()}`;
}

function readRecords(owner: string): AgentRecord[] {
  if (!isBrowser() || !owner) return [];
  try {
    const raw = window.localStorage.getItem(keyFor(owner));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is AgentRecord => typeof r === "object" && r !== null && "passportId" in r);
  } catch {
    return [];
  }
}

function writeRecords(owner: string, records: AgentRecord[]) {
  if (!isBrowser() || !owner) return;
  window.localStorage.setItem(keyFor(owner), JSON.stringify(records));
}

export function listAgents(owner: string): AgentRecord[] {
  return readRecords(owner);
}

export function saveAgent(record: Omit<AgentRecord, "v" | "createdAt"> & { createdAt?: string }): AgentRecord {
  const owner = record.ownerAddress.toLowerCase();
  const full: AgentRecord = {
    ...record,
    ownerAddress: owner,
    createdAt: record.createdAt ?? new Date().toISOString(),
    v: SCHEMA_VERSION
  };
  const existing = readRecords(owner).filter((r) => r.passportId !== full.passportId);
  writeRecords(owner, [full, ...existing]);
  return full;
}

export function removeAgent(owner: string, passportId: string) {
  const remaining = readRecords(owner).filter((r) => r.passportId !== passportId);
  writeRecords(owner, remaining);
}

/// Trigger a download of a single agent's backup as JSON. Includes the
/// private key, so users should treat the file as sensitive.
export function downloadAgentBackup(record: AgentRecord, contractAddress?: string) {
  if (!isBrowser()) return;
  if (!record.privateKey) return;
  const payload = {
    schema: "agent-passport-backup",
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    chain: { name: "Avalanche Fuji", id: 43113 },
    contractAddress: contractAddress ?? null,
    agent: record
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agent-passport-${record.passportId}-${record.agentAddress.slice(2, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Contract address persistence ----------
//
// We let users set NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS at build time, use the
// checked-in deployment address, or deploy from the UI and stash the address in
// localStorage. The dashboard prefers env, then deployments.json, then
// localStorage.

export function getStoredContractAddress(): string | null {
  if (!isBrowser()) return null;
  const v = window.localStorage.getItem(CONTRACT_KEY);
  return v && v.startsWith("0x") && v.length === 42 ? v : null;
}

export function setStoredContractAddress(address: string) {
  if (!isBrowser()) return;
  if (!address.startsWith("0x") || address.length !== 42) return;
  window.localStorage.setItem(CONTRACT_KEY, address);
}

export function clearStoredContractAddress() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(CONTRACT_KEY);
}
