import "server-only";
import { cache } from "react";

import { getSupabase } from "@/lib/db/supabase";
import { getCurrentThirdwebSession } from "@/lib/thirdweb/auth";
import {
  initialOnboardingStep,
  type OnboardingState,
  type OnboardingUserRow,
} from "./onboarding-gate";

export type { OnboardingState } from "./onboarding-gate";

export const getOnboardingState = cache(async (): Promise<OnboardingState> => {
  const session = await getCurrentThirdwebSession();
  if (!session) return { signedIn: false };

  const supabase = getSupabase();
  const { data } = await supabase
    .from("users")
    .select("username, onboarded_at")
    .eq("thirdweb_id", session.thirdwebId)
    .maybeSingle();

  const row = (data as OnboardingUserRow | null) ?? null;
  return {
    signedIn: true,
    step: initialOnboardingStep(row),
    username: row?.username ?? null,
  };
});
