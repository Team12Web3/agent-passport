import { NextRequest, NextResponse } from "next/server";

import { getSupabase } from "@/lib/db/supabase";
import { getCurrentThirdwebSession } from "@/lib/thirdweb/auth";

export const runtime = "nodejs";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type Body = { username?: string };

export async function POST(req: NextRequest) {
  const session = await getCurrentThirdwebSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const supplied = (body.username ?? "").trim().toLowerCase();
  const supabase = getSupabase();

  // Username may already be persisted by `/api/onboarding/username` from step 1.
  // If a value is supplied we treat it as authoritative; otherwise we fall back
  // to whatever is already on the row.
  let usernameToWrite: string | null = null;
  if (supplied) {
    if (!USERNAME_RE.test(supplied)) {
      return NextResponse.json({ error: "invalid_username" }, { status: 400 });
    }
    const { data: existing } = await supabase
      .from("users")
      .select("id, thirdweb_id")
      .ilike("username", supplied)
      .maybeSingle();
    if (existing && existing.thirdweb_id !== session.thirdwebId) {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    usernameToWrite = supplied;
  } else {
    const { data: row } = await supabase
      .from("users")
      .select("username")
      .eq("thirdweb_id", session.thirdwebId)
      .maybeSingle();
    if (!row?.username) {
      return NextResponse.json({ error: "invalid_username" }, { status: 400 });
    }
  }

  const update: { onboarded_at: string; username?: string } = {
    onboarded_at: new Date().toISOString(),
  };
  if (usernameToWrite) update.username = usernameToWrite;

  const { data, error } = await supabase
    .from("users")
    .update(update)
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
