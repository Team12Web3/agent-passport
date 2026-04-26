"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

import { fadeIn, scaleIn, slideX, useMotionVariant } from "@/lib/motion";
import { StepUsername } from "./StepUsername";
import { StepBalance } from "./StepBalance";
import { StepMint } from "./StepMint";

type Step = "username" | "balance" | "mint";

export function OnboardingOverlay() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState<string>("");

  const backdrop = useMotionVariant(fadeIn);
  const panel = useMotionVariant(scaleIn);
  const slide = useMotionVariant(slideX);

  const onComplete = useCallback(() => {
    // Force the layout's server-side state to refresh. After this refetch
    // onboarded_at is set and the overlay won't render again.
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
        className="card relative w-full max-w-md overflow-hidden"
      >
        <div className="border-b border-white/[0.06] px-6 py-4">
          <div className="eyebrow">Welcome</div>
          <div className="mt-1 text-[13px] text-muted">
            Three quick steps · {step === "username" ? "1" : step === "balance" ? "2" : "3"} of 3
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
                onNext={(u) => {
                  setUsername(u);
                  setStep("balance");
                }}
              />
            </motion.div>
          )}
          {step === "balance" && (
            <motion.div
              key="balance"
              initial={slide.initial}
              animate={slide.animate}
              exit={slide.exit}
            >
              <StepBalance onNext={() => setStep("mint")} />
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
