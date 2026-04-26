import { describe, expect, it } from "vitest";
import { MOTION, fadeUp, fadeIn, scaleIn, slideX, stagger, flatten } from "./motion";

describe("motion variants", () => {
  it("exposes a single source of truth for durations and easings", () => {
    expect(MOTION.duration.fast).toBeCloseTo(0.18);
    expect(MOTION.duration.base).toBeCloseTo(0.24);
    expect(Array.isArray(MOTION.ease)).toBe(true);
  });

  it("fadeUp animates opacity and y", () => {
    expect(fadeUp.initial).toEqual({ opacity: 0, y: 8 });
    expect(fadeUp.animate.opacity).toBe(1);
    expect(fadeUp.animate.y).toBe(0);
  });

  it("scaleIn animates opacity and scale", () => {
    expect(scaleIn.initial).toEqual({ opacity: 0, scale: 0.96 });
    expect(scaleIn.animate.opacity).toBe(1);
    expect(scaleIn.animate.scale).toBe(1);
  });

  it("slideX has direction-aware initial state", () => {
    expect(slideX.initial.x).toBe(24);
    expect(slideX.exit.x).toBe(-24);
  });

  it("stagger orchestrates children", () => {
    expect(stagger.animate.transition.staggerChildren).toBeGreaterThan(0);
  });

  it("flatten() collapses motion variants to opacity-only", () => {
    const flat = flatten(fadeUp);
    expect(flat.initial).toEqual({ opacity: 0 });
    expect(flat.animate.opacity).toBe(1);
    // y must not be present in the flattened variant
    expect((flat.animate as Record<string, unknown>).y).toBeUndefined();
  });
});
