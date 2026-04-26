import "server-only";
import { cache } from "react";

import { getSupabase } from "@/lib/db/supabase";
import { getCurrentThirdwebSession } from "@/lib/thirdweb/auth";

export type OnboardingState =
  | { signedIn: false }
  | { signedIn: true; needsOnboarding: boolean; username: string | null };

// Cached per request so layout + page reads share one query.
export const getOnboardingState = cache(async (): Promise<OnboardingState> => {
  const session = await getCurrentThirdwebSession();
  if (!session) return { signedIn: false };

  const supabase = getSupabase();
  const { data } = await supabase
    .from("users")
    .select("username, onboarded_at")
    .eq("thirdweb_id", session.thirdwebId)
    .maybeSingle();

  // No row yet (first visit between login and sync) — treat as needing onboarding.
  if (!data) return { signedIn: true, needsOnboarding: true, username: null };

  return {
    signedIn: true,
    needsOnboarding: !data.onboarded_at,
    username: data.username,
  };
});
