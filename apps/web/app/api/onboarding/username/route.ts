import { NextRequest, NextResponse } from "next/server";

import { getSupabase } from "@/lib/db/supabase";
import { getCurrentThirdwebSession } from "@/lib/thirdweb/auth";

export const runtime = "nodejs";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type Body = { username?: string };

// Persists the chosen username on the user's row partway through onboarding.
// `wallet_address` is already on the row from `/api/auth/sync` at login, so
// writing username here is what links the handle to the wallet in Supabase.
//
// Intentionally does NOT set `onboarded_at` — that happens in
// `/api/onboarding/complete` once the user either mints an agent or skips.
export async function POST(req: NextRequest) {
  const session = await getCurrentThirdwebSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { username } = (await req.json()) as Body;
  const u = (username ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(u)) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("users")
    .select("id, thirdweb_id")
    .ilike("username", u)
    .maybeSingle();

  if (existing && existing.thirdweb_id !== session.thirdwebId) {
    return NextResponse.json({ error: "username_taken" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("users")
    .update({ username: u })
    .eq("thirdweb_id", session.thirdwebId)
    .select("id, thirdweb_id, username, onboarded_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
