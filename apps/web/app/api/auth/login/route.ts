import { NextRequest, NextResponse } from "next/server";
import type { VerifyLoginPayloadParams } from "thirdweb/auth";

import {
  generateAuthJwt,
  getAuthCookieMaxAgeSeconds,
  getAuthCookieName,
  verifyLoginPayload,
} from "@/lib/thirdweb/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as VerifyLoginPayloadParams;
  const verified = await verifyLoginPayload(payload);

  if (!verified.valid) {
    return NextResponse.json({ error: "invalid_login_payload" }, { status: 401 });
  }

  const jwt = await generateAuthJwt(verified.payload);
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: getAuthCookieName(),
    value: jwt,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getAuthCookieMaxAgeSeconds(),
  });

  return response;
}
