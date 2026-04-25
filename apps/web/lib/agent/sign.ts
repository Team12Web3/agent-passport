import "server-only";
import { keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { decryptAgentKey } from "./wallet";

// ─── Person-2 stub (TEMPORARY) ─────────────────────────────────────────────
// Reference signing for outbound trust headers. Final implementation lives
// with Person 2; keep the function signature stable so the runtime doesn't
// need to change when it's swapped.
// ────────────────────────────────────────────────────────────────────────────

export type TrustHeaders = {
  "X-Agent-Passport-ID": string;
  "X-Agent-Signature":   Hex;
  "X-Agent-Timestamp":   string;
};

function digest(passportId: string, url: string, timestamp: string): Hex {
  return keccak256(toBytes(`${passportId}|${url}|${timestamp}`));
}

export async function buildTrustHeaders(opts: {
  passportId: string;
  url: string;
  encryptedKey: string;
}): Promise<TrustHeaders> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const account = privateKeyToAccount(decryptAgentKey(opts.encryptedKey));
  const message = digest(opts.passportId, opts.url, timestamp);
  const signature = await account.signMessage({ message: { raw: message } });

  return {
    "X-Agent-Passport-ID": opts.passportId,
    "X-Agent-Signature":   signature,
    "X-Agent-Timestamp":   timestamp,
  };
}

export function digestForVerify(passportId: string, url: string, timestamp: string): Hex {
  return digest(passportId, url, timestamp);
}
