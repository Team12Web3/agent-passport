import { NextRequest, NextResponse } from "next/server";

import { getSupabase } from "@/lib/db/supabase";
import { getCurrentThirdwebSession } from "@/lib/thirdweb/auth";

type SyncRequestBody = {
  email?: string | null;
};

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getCurrentThirdwebSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as SyncRequestBody;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        thirdweb_id: session.thirdwebId,
        wallet_address: session.address,
        email: body.email ?? null,
      },
      { onConflict: "thirdweb_id" },
    )
    .select("id, thirdweb_id, email, wallet_address, username, onboarded_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    user: data,
    needsOnboarding: !data.onboarded_at,
  });
}
