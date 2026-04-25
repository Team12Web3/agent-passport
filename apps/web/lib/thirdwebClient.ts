import { createThirdwebClient, type ThirdwebClient } from "thirdweb";

let cached: ThirdwebClient | null = null;
let cachedClientId: string | null = null;

function readClientId(): string {
  // Support both the legacy hackathon name and the new `_TW_CLIENT_ID` alias
  // so .env files from either codebase keep working.
  const raw =
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ??
    process.env.NEXT_PUBLIC_TW_CLIENT_ID ??
    "";
  return typeof raw === "string" ? raw.trim() : "";
}

export function getThirdwebClient(): ThirdwebClient | null {
  const clientId = readClientId();
  if (!clientId || clientId === "REPLACE_ME") return null;

  // If env changes during dev, rebuild the client instead of serving a stale one.
  if (cached && cachedClientId !== clientId) {
    cached = null;
    cachedClientId = null;
  }

  if (!cached) {
    cached = createThirdwebClient({ clientId });
    cachedClientId = clientId;
  }
  return cached;
}
