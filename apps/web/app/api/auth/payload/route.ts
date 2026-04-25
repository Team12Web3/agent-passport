import { NextRequest, NextResponse } from "next/server";
import { avalancheFuji } from "thirdweb/chains";

import { generateLoginPayload } from "@/lib/thirdweb/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  const payload = await generateLoginPayload({
    address,
    chainId: avalancheFuji.id,
  });

  return NextResponse.json(payload);
}
