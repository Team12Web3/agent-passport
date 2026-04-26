import { NextRequest, NextResponse } from "next/server";

import { getSupabase } from "@/lib/db/supabase";
import { getCurrentThirdwebSession } from "@/lib/thirdweb/auth";

export const runtime = "nodejs";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function GET(req: NextRequest) {
  const session = await getCurrentThirdwebSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const u = (req.nextUrl.searchParams.get("u") ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(u)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .ilike("username", u)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ available: !data });
}
