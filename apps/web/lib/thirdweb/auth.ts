import "server-only";

import { cookies, headers } from "next/headers";
import { createThirdwebClient } from "thirdweb";
import {
  createAuth,
  type LoginPayload,
  type VerifyLoginPayloadParams,
} from "thirdweb/auth";
import { privateKeyToAccount } from "thirdweb/wallets";

const AUTH_COOKIE_NAME = "jwt";
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function stripProtocol(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function getHostFromHeaders(): string | null {
  const requestHeaders = headers();
  return (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    null
  );
}

export function getThirdwebAuthDomain(): string {
  const host = getHostFromHeaders();
  const configured =
    process.env.NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL;

  // In local dev the app can move from 3000 to 3001 when the default port is
  // occupied. SIWE domains must match the actual request host, so prefer the
  // live localhost host over a stale env value.
  if (host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
    return stripProtocol(host);
  }

  if (configured) {
    return stripProtocol(configured);
  }

  if (!host) {
    throw new Error(
      "Missing auth domain. Set NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN or NEXT_PUBLIC_APP_URL.",
    );
  }

  return stripProtocol(host);
}

function getThirdwebServerClient() {
  const secretKey = getRequiredEnv("THIRDWEB_SECRET_KEY");
  return createThirdwebClient({ secretKey });
}

type ThirdwebAuth = ReturnType<typeof createAuth>;
type VerifyLoginPayloadResult = Awaited<ReturnType<ThirdwebAuth["verifyPayload"]>>;
type VerifiedLoginPayload = Extract<
  VerifyLoginPayloadResult,
  { valid: true; payload: unknown }
>["payload"];

export function getThirdwebAuth() {
  const client = getThirdwebServerClient();

  return createAuth({
    domain: getThirdwebAuthDomain(),
    client,
    adminAccount: privateKeyToAccount({
      client,
      privateKey: getRequiredEnv("AUTH_PRIVATE_KEY"),
    }),
  });
}

export type ThirdwebSession = {
  jwt: string;
  address: `0x${string}`;
  thirdwebId: string;
  parsedJWT: {
    sub: string;
    [key: string]: unknown;
  };
};

export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}

export function getAuthCookieMaxAgeSeconds(): number {
  return AUTH_COOKIE_MAX_AGE_SECONDS;
}

export async function generateLoginPayload(params: {
  address: string;
  chainId?: number;
}): Promise<LoginPayload> {
  return getThirdwebAuth().generatePayload(params);
}

export async function verifyLoginPayload(
  params: VerifyLoginPayloadParams,
) {
  return getThirdwebAuth().verifyPayload(params);
}

export async function generateAuthJwt(
  payload: VerifiedLoginPayload,
): Promise<string> {
  return getThirdwebAuth().generateJWT({ payload });
}

export async function verifyAuthJwt(
  jwt: string,
): Promise<ThirdwebSession | null> {
  const result = await getThirdwebAuth().verifyJWT({ jwt });
  if (!result.valid || !result.parsedJWT?.sub) {
    return null;
  }

  const address = result.parsedJWT.sub.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return null;
  }

  return {
    jwt,
    address: address as `0x${string}`,
    thirdwebId: result.parsedJWT.sub,
    parsedJWT: result.parsedJWT as ThirdwebSession["parsedJWT"],
  };
}

export async function getCurrentThirdwebSession(): Promise<ThirdwebSession | null> {
  const jwt = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!jwt) {
    return null;
  }
  return verifyAuthJwt(jwt);
}
