import { useReducedMotion, type Variants } from "framer-motion";

export const MOTION = {
  duration: { fast: 0.18, base: 0.24, slow: 0.36 },
  ease: [0.22, 1, 0.36, 1] as const,
} as const;

const baseTransition = { duration: MOTION.duration.base, ease: MOTION.ease };

export type MotionVariant = {
  initial: Record<string, number>;
  animate: Record<string, number> & { transition?: Record<string, unknown> };
  exit?: Record<string, number> & { transition?: Record<string, unknown> };
};

export const fadeIn: MotionVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: baseTransition },
  exit: { opacity: 0, transition: { ...baseTransition, duration: MOTION.duration.fast } },
};

export const fadeUp: MotionVariant = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: baseTransition },
  exit: { opacity: 0, y: -4, transition: { ...baseTransition, duration: MOTION.duration.fast } },
};

export const scaleIn: MotionVariant = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: baseTransition },
  exit: { opacity: 0, scale: 0.98, transition: { ...baseTransition, duration: MOTION.duration.fast } },
};

export const slideX: MotionVariant = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: baseTransition },
  exit: { opacity: 0, x: -24, transition: { ...baseTransition, duration: MOTION.duration.fast } },
};

export const stagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
} as const satisfies Variants;

export function flatten(v: MotionVariant): MotionVariant {
  const keep = (s: Record<string, unknown>) => ({ opacity: s.opacity ?? 1 });
  return {
    initial: { opacity: v.initial.opacity ?? 0 },
    animate: { ...keep(v.animate), transition: v.animate.transition },
    exit: v.exit ? { ...keep(v.exit), transition: v.exit.transition } : undefined,
  } as MotionVariant;
}

export function useMotionVariant(v: MotionVariant): MotionVariant {
  const reduce = useReducedMotion();
  return reduce ? flatten(v) : v;
}
