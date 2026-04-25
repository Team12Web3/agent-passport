import "server-only";
import { cookies } from "next/headers";
import { getSupabase, type UserRow } from "../db/supabase";

// ─── Person-2 stub (TEMPORARY) ─────────────────────────────────────────────
// Resolve the current user from a Thirdweb session cookie. Person 2 will
// replace the cookie-parsing with real session verification; for the first
// 4 hours we just trust the cookie value so end-to-end testing works.
// ────────────────────────────────────────────────────────────────────────────

export type Session = { user: UserRow };

const COOKIE_NAME = "tw_session";

export async function getSessionUser(): Promise<Session | null> {
  const c = cookies().get(COOKIE_NAME);
  if (!c?.value) return null;

  const thirdwebId = c.value;
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("thirdweb_id", thirdwebId)
    .maybeSingle();

  if (existing) return { user: existing as UserRow };

  const { data: inserted, error } = await supabase
    .from("users")
    .insert({ thirdweb_id: thirdwebId })
    .select("*")
    .single();

  if (error || !inserted) return null;
  return { user: inserted as UserRow };
}

export async function requireSessionUser(): Promise<Session> {
  const s = await getSessionUser();
  if (!s) throw new UnauthorizedError();
  return s;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
  }
}
