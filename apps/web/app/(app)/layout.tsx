import type { ReactNode } from "react";

import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { shouldShowOnboarding } from "./onboarding-gate";
import { getOnboardingState } from "./onboarding-state";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const state = await getOnboardingState();
  return (
    <>
      {children}
      {shouldShowOnboarding(state) && state.signedIn && state.step && (
        <OnboardingOverlay
          initialStep={state.step}
          initialUsername={state.username ?? ""}
        />
      )}
    </>
  );
}
