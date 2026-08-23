/*
 * TypeScript mirror of the CSS motion tokens in globals.css.
 * Framer Motion cannot read CSS custom properties for transitions,
 * so these constants are the single source for motion values in code.
 * Seconds here correspond to --motion-fast/base/slow and --ease-standard.
 */
export const motionDurations = {
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
} as const;

export const easeStandard = [0.2, 0, 0, 1] as const;

export const revealStaggerStep = 0.06;

export const revealOffsetPx = 12;
