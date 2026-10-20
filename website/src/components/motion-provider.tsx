"use client";

import { MotionConfig } from "motion/react";

// "user" turns transform and layout animations off when the visitor asks for reduced motion.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
