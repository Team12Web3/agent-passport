"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

import { fadeIn, scaleIn, slideX, useMotionVariant } from "@/lib/motion";
import { StepUsername } from "./StepUsername";
import { StepMint } from "./StepMint";

type Step = "username" | "mint";

export function OnboardingOverlay({
  initialStep = "username",
  initialUsername = "",
}: {
  initialStep?: Step;
  initialUsername?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [username, setUsername] = useState<string>(initialUsername);

  const backdrop = useMotionVariant(fadeIn);
  const panel = useMotionVariant(scaleIn);
  const slide = useMotionVariant(slideX);

  const onComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <motion.div
      initial={backdrop.initial}
      animate={backdrop.animate}
      exit={backdrop.exit}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="First-time onboarding"
    >
      <motion.div
        initial={panel.initial}
        animate={panel.animate}
        className="card relative w-full max-w-lg overflow-hidden"
      >
        <div className="border-b border-white/[0.06] px-6 py-5">
          <div className="eyebrow">Welcome to Agent Passport</div>
          <h1 className="text-balance mt-3 text-[24px] font-semibold leading-tight tracking-tight">
            Let&apos;s set up your first agent passport.
          </h1>
          <p className="mt-2 max-w-[58ch] text-[13px] leading-5 text-muted">
            Choose the handle people will recognize, then we&apos;ll create your first agent passport
            on Fuji.
          </p>
          <div className="mt-4 flex items-center gap-2 text-[12px] text-subtle">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 text-emerald-200">
              {step === "username" ? "1" : "2"}
            </span>
            <span>Two quick steps</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "username" && (
            <motion.div
              key="username"
              initial={slide.initial}
              animate={slide.animate}
              exit={slide.exit}
            >
              <StepUsername
                initialValue={username}
                onNext={(u) => {
                  setUsername(u);
                  setStep("mint");
                }}
              />
            </motion.div>
          )}
          {step === "mint" && (
            <motion.div
              key="mint"
              initial={slide.initial}
              animate={slide.animate}
              exit={slide.exit}
            >
              <StepMint username={username} onComplete={onComplete} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
