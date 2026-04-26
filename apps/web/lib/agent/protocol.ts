import { keccak256, toBytes, type Hex } from "viem";

type TermsAwareOptions = {
  termsHash?: Hex;
};

type TrustDigestOptions = TermsAwareOptions & {
  passportId: string;
  url: string;
  timestamp: string;
  intentHash: Hex;
};

type SessionProofOptions = TermsAwareOptions & {
  passportId: string;
  timestamp: string;
  intentHash: Hex;
  ownerWallet?: string;
};

type IntentProofOptions = TermsAwareOptions & {
  passportId: string;
  timestamp: string;
  intentHash: Hex;
  actionHash: Hex;
  ownerWallet?: string;
};

type SessionGrantDigestOptions = {
  passportId: string;
  ownerWallet: string;
  sessionKey: string;
  issuedAt: number;
  expiresAt: number;
  allowedOrigins: string[];
  allowedActions: string[];
  maxAmountUsd: string;
};

type ClaimsDigestOptions = {
  passportId: string;
  developer: string;
  developerWallet: string;
  modelPlatform: string;
  labels: string[];
  complianceClaims: string[];
  trustScore: number;
  easUid?: string | null;
  issuedAt: number;
  version: number;
  sessionKey?: string | null;
};

export function canonicalizeValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") return value.toString();

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeValue(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalizeValue(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(String(value));
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(value, "base64"));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeHeaderJson(value: unknown): string {
  const encoded = encodeBase64(new TextEncoder().encode(JSON.stringify(value)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeHeaderJson<T>(value: string): T {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : normalized.padEnd(normalized.length + (4 - (normalized.length % 4)), "=");
  return JSON.parse(new TextDecoder().decode(decodeBase64(padded))) as T;
}

export function normalizeTermsHash(termsHash?: string): Hex {
  if (termsHash) {
    return /^0x[0-9a-fA-F]{64}$/.test(termsHash)
      ? (termsHash.toLowerCase() as Hex)
      : keccak256(toBytes(termsHash));
  }

  return keccak256(
    toBytes(process.env.AGENT_TERMS_TEXT ?? "agent-passport-demo-terms-v1"),
  );
}

export function buildIntentHash(intent: unknown): Hex {
  return keccak256(toBytes(canonicalizeValue(intent)));
}

export function buildActionHash(action: unknown): Hex {
  return keccak256(toBytes(canonicalizeValue(action)));
}

export function buildTrustDigest(options: TrustDigestOptions): Hex {
  const termsHash = options.termsHash ?? normalizeTermsHash();
  return keccak256(
    toBytes(
      [
        options.passportId,
        options.url,
        options.timestamp,
        termsHash,
        options.intentHash,
      ].join("|"),
    ),
  );
}

export function buildSessionProofDigest(options: SessionProofOptions): Hex {
  const termsHash = options.termsHash ?? normalizeTermsHash();
  return keccak256(
    toBytes(
      [
        "session",
        options.passportId,
        options.ownerWallet?.toLowerCase() ?? "unbound",
        options.timestamp,
        termsHash,
        options.intentHash,
      ].join("|"),
    ),
  );
}

export function buildIntentProofDigest(options: IntentProofOptions): Hex {
  const termsHash = options.termsHash ?? normalizeTermsHash();
  return keccak256(
    toBytes(
      [
        "intent-proof",
        options.passportId,
        options.ownerWallet?.toLowerCase() ?? "unbound",
        options.timestamp,
        termsHash,
        options.intentHash,
        options.actionHash,
      ].join("|"),
    ),
  );
}

export function buildSessionGrantDigest(
  options: SessionGrantDigestOptions,
): Hex {
  return keccak256(
    toBytes(
      canonicalizeValue({
        type: "agent-passport/session-grant",
        passportId: options.passportId,
        ownerWallet: options.ownerWallet.toLowerCase(),
        sessionKey: options.sessionKey.toLowerCase(),
        issuedAt: options.issuedAt,
        expiresAt: options.expiresAt,
        allowedOrigins: [...options.allowedOrigins].sort(),
        allowedActions: [...options.allowedActions].sort(),
        maxAmountUsd: options.maxAmountUsd,
      }),
    ),
  );
}

export function buildClaimsDigest(options: ClaimsDigestOptions): Hex {
  return keccak256(
    toBytes(
      canonicalizeValue({
        "@context": "https://agentpassport.dev/claims/v1",
        type: "AgentPassportClaims",
        passportId: options.passportId,
        developer: options.developer,
        developerWallet: options.developerWallet.toLowerCase(),
        modelPlatform: options.modelPlatform,
        labels: [...options.labels].sort(),
        complianceClaims: [...options.complianceClaims].sort(),
        trustScore: options.trustScore,
        easUid: options.easUid ?? null,
        issuedAt: options.issuedAt,
        version: options.version,
        sessionKey: options.sessionKey?.toLowerCase() ?? null,
      }),
    ),
  );
}
