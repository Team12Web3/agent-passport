import { createThirdwebClient, type ThirdwebClient } from "thirdweb";

let cached: ThirdwebClient | null = null;
let cachedClientId: string | null = null;

export function getThirdwebClient(): ThirdwebClient | null {
  const raw = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
  const clientId = typeof raw === "string" ? raw.trim() : "";
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
