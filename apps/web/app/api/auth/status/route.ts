import { NextResponse } from "next/server";

import { getCurrentThirdwebSession } from "@/lib/thirdweb/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentThirdwebSession();

  return NextResponse.json({
    loggedIn: !!session,
    address: session?.address ?? null,
  });
}
