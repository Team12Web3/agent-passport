import type { ReactNode } from "react";

import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { getOnboardingState } from "./onboarding-state";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const state = await getOnboardingState();
  const showOnboarding = state.signedIn && state.needsOnboarding;
  return (
    <>
      {children}
      {showOnboarding && <OnboardingOverlay />}
    </>
  );
}
