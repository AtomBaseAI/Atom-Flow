"use client"

/**
 * DockIn — staggered entrance wrapper for board chrome controls.
 *
 * Every toolbar button starts hidden while the splash screen plays. When the
 * splash hands over, each control "docks" in one after another: it pops from
 * a small scale with a springy overshoot (macOS-dock feel) and a per-item
 * delay derived from its global index, so the whole UI assembles in a single
 * sequential wave.
 */

import type { ReactNode } from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

type DockInProps = {
  /** Global position in the entrance sequence — 0 docks first */
  index: number
  /** When false the control stays hidden (splash phase) */
  booted: boolean
  /** Delay multiplier per step in seconds */
  step?: number
  className?: string
  children: ReactNode
}

export function DockIn({ index, booted, step = 0.055, className, children }: DockInProps) {
  return (
    <motion.div
      className={cn("min-w-0", className)}
      initial="hidden"
      animate={booted ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0, scale: 0.2, y: 16 },
        visible: { opacity: 1, scale: 1, y: 0 },
      }}
      transition={
        booted
          ? {
              delay: index * step,
              type: "spring",
              stiffness: 530,
              damping: 30,
              mass: 0.9,
              opacity: { duration: 0.28, delay: index * step, ease: "easeOut" },
            }
          : { duration: 0 }
      }
    >
      {children}
    </motion.div>
  )
}

export default DockIn
