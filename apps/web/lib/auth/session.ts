import "server-only";

import { getSupabase, type UserRow } from "../db/supabase";
import { getCurrentThirdwebSession } from "../thirdweb/auth";

export type Session = { user: UserRow };

export async function getSessionUser(): Promise<Session | null> {
  const session = await getCurrentThirdwebSession();
  if (!session) {
    return null;
  }

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("thirdweb_id", session.thirdwebId)
    .maybeSingle();

  if (existing) {
    if (
      session.address &&
      existing.wallet_address?.toLowerCase() !== session.address.toLowerCase()
    ) {
      const { data: updated } = await supabase
        .from("users")
        .update({ wallet_address: session.address })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (updated) return { user: updated as UserRow };
    }
    return { user: existing as UserRow };
  }

  const { data: inserted, error } = await supabase
    .from("users")
    .insert({
      thirdweb_id: session.thirdwebId,
      wallet_address: session.address,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    return null;
  }

  return { user: inserted as UserRow };
}

export async function requireSessionUser(): Promise<Session> {
  const session = await getSessionUser();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
  }
}
