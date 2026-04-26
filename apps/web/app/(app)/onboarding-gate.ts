export type OnboardingUserRow = {
  username: string | null;
  onboarded_at: string | null;
};

export type OnboardingStep = "username" | "mint" | null;

export type OnboardingState =
  | { signedIn: false }
  | {
      signedIn: true;
      step: OnboardingStep;
      username: string | null;
    };

// Single source of truth for "where is this user in onboarding".
// - No row yet (login/sync race): treat as fresh user → "username".
// - Already finished (onboarded_at set): hide overlay, even if they skipped the agent.
// - Username chosen but not finished: resume at the mint step.
// - Default: start at username step.
export function initialOnboardingStep(data: OnboardingUserRow | null): OnboardingStep {
  if (!data) return "username";
  if (data.onboarded_at) return null;
  if (data.username) return "mint";
  return "username";
}

export function shouldShowOnboarding(state: OnboardingState): boolean {
  return state.signedIn && state.step !== null;
}
