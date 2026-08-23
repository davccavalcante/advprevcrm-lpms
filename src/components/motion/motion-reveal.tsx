"use client";

import { MotionConfig, motion } from "framer-motion";
import {
  easeStandard,
  motionDurations,
  revealOffsetPx,
  revealStaggerStep,
} from "@/lib/motion-tokens";

type MotionRevealProps = {
  children: React.ReactNode;
  order?: number;
  className?: string;
};

/*
 * Entrance reveal for dashboard blocks. reducedMotion="user" makes Framer
 * Motion honor prefers-reduced-motion by disabling the transform animation.
 */
export function MotionReveal({
  children,
  order = 0,
  className,
}: MotionRevealProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: revealOffsetPx }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: motionDurations.base,
          ease: easeStandard,
          delay: order * revealStaggerStep,
        }}
        className={className}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
