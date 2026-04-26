"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { fadeIn, useMotionVariant } from "@/lib/motion";

export default function AppTemplate({ children }: { children: ReactNode }) {
  const v = useMotionVariant(fadeIn);
  return (
    <motion.div initial={v.initial} animate={v.animate}>
      {children}
    </motion.div>
  );
}
