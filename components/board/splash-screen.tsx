"use client"

/**
 * SplashScreen — opening sequence for the board.
 *
 * For the first 5 seconds the page shows nothing but the "Atom Flow" title
 * scrambling in through the MagicUI HyperText effect, floating over a dashed
 * MagicUI HexagonPattern honeycomb backdrop. When the board hands over, the
 * overlay's background (pattern included) fades away and the title drifts up
 * while the toolbar controls dock in one by one behind it (see DockIn).
 *
 * The overlay is purely visual: the board keeps booting underneath, so any
 * state stored in localStorage is restored (or an empty starter board is
 * shown) exactly as before.
 */

import { motion } from "motion/react"

import { HexagonPattern } from "@/components/magicui/hexagon-pattern"
import { HyperText } from "@/components/magicui/hyper-text"

type SplashScreenProps = {
  /** When true the overlay fades out and reports back via onExited */
  leaving: boolean
  /** Called once the leave transition has finished (unmount the overlay) */
  onExited: () => void
}

export function SplashScreen({ leaving, onExited }: SplashScreenProps) {
  // Exit choreography: the honeycomb backdrop dissolves FIRST (0 → 0.35s),
  // and only then the title fades (0.4 → 0.8s) while the overlay itself
  // clears behind it (0.4 → 0.85s). Fading everything at once made the
  // pattern and text vanish simultaneously — the backdrop must go first so
  // the title is the last thing on screen.
  return (
    <motion.div
      aria-hidden={leaving}
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden"
      style={{ background: "var(--af-board-bg)" }}
      initial={{ opacity: 1 }}
      animate={leaving ? { opacity: 0 } : { opacity: 1 }}
      transition={
        leaving
          ? { delay: 0.4, duration: 0.45, ease: "easeOut" }
          : { duration: 0.3 }
      }
      onAnimationComplete={() => {
        if (leaving) onExited()
      }}
    >
      {/* Dashed honeycomb backdrop (MagicUI HexagonPattern) — the same pattern
          used by the board's hex background variant. It drifts gently into
          place on mount and sinks away together with the leave transition.
          A radial mask keeps the honeycomb strongest around the title and
          dissolves it toward the screen edges. */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 1.08 }}
        animate={leaving ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }}
        transition={
          leaving
            ? { duration: 0.35, ease: "easeIn" }
            : { duration: 1.8, ease: "easeOut" }
        }
      >
        <HexagonPattern
          radius={40}
          x={-1}
          y={-1}
          strokeDasharray="4 2"
          className="[mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black_35%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black_35%,transparent_100%)]"
        />
      </motion.div>

      {/* Soft backdrop glow so the title always stays readable over the honeycomb */}
      <div
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_38rem_16rem_at_50%_50%,var(--af-board-bg)_0%,transparent_70%)]"
        aria-hidden="true"
      />

      <motion.div
        className="pointer-events-none relative flex select-none flex-col items-center"
        animate={leaving ? { opacity: 0, scale: 1.12, y: -14 } : { opacity: 1, scale: 1, y: 0 }}
        transition={
          leaving
            ? {
                // Drift starts immediately; the actual fade waits until the
                // hexagon backdrop has fully dissolved (0.35s).
                scale: { duration: 0.65, ease: "easeOut" },
                y: { duration: 0.65, ease: "easeOut" },
                opacity: { delay: 0.4, duration: 0.4, ease: "easeOut" },
              }
            : { duration: 0.5 }
        }
      >
        <HyperText
          as="h1"
          animateOnHover={false}
          duration={1500}
          delay={250}
          className="py-2 text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl"
        >
          Atom Flow
        </HyperText>
        <motion.span
          className="mt-1 text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: leaving ? 0 : 1 }}
          transition={leaving ? { duration: 0.3 } : { delay: 1.9, duration: 0.7 }}
        >
          Atom Labs
        </motion.span>
      </motion.div>
    </motion.div>
  )
}

export default SplashScreen
