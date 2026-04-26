import { describe, expect, it } from "vitest";

import { initialOnboardingStep, shouldShowOnboarding } from "./onboarding-gate";

describe("initialOnboardingStep", () => {
  it("starts at username when no row exists yet (login/sync race)", () => {
    expect(initialOnboardingStep(null)).toBe("username");
  });

  it("starts at username when neither username nor onboarded_at are set", () => {
    expect(initialOnboardingStep({ username: null, onboarded_at: null })).toBe("username");
  });

  it("resumes at mint when username is saved but onboarded_at is not", () => {
    expect(initialOnboardingStep({ username: "alice", onboarded_at: null })).toBe("mint");
  });

  it("returns null once onboarded_at is set", () => {
    expect(
      initialOnboardingStep({ username: "alice", onboarded_at: "2026-04-26T00:00:00.000Z" }),
    ).toBeNull();
  });

  it("returns null when onboarded_at is set even without a username (skip edge case)", () => {
    expect(
      initialOnboardingStep({ username: null, onboarded_at: "2026-04-26T00:00:00.000Z" }),
    ).toBeNull();
  });
});

describe("shouldShowOnboarding", () => {
  it("hides the modal for signed-out users", () => {
    expect(shouldShowOnboarding({ signedIn: false })).toBe(false);
  });

  it("hides the modal once step is null", () => {
    expect(shouldShowOnboarding({ signedIn: true, step: null, username: "alice" })).toBe(false);
  });

  it("shows the modal for signed-in users with a pending step", () => {
    expect(shouldShowOnboarding({ signedIn: true, step: "username", username: null })).toBe(true);
    expect(shouldShowOnboarding({ signedIn: true, step: "mint", username: "alice" })).toBe(true);
  });
});
