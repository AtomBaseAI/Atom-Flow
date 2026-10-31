"use client"

/**
 * MagicUI "Animated Theme Toggler" — adapted for the Atom Flow board chrome.
 *
 * Switching themes triggers a circular clip-path reveal (View Transitions API)
 * that expands from the click point, sweeping the new theme across the page.
 * Falls back to an instant switch when the browser has no View Transitions
 * support (e.g. Firefox/Safari without the flag).
 *
 * Source pattern: https://magicui.design/docs/components/animated-theme-toggler
 */

import * as React from "react"
import { flushSync } from "react-dom"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => { ready: Promise<void> }
}

export function AnimatedThemeToggler({
  className,
  duration = 700,
  ...props
}: React.ComponentProps<"button"> & { duration?: number }) {
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const nextTheme = resolvedTheme === "dark" ? "light" : "dark"
      const doc = document as DocumentWithViewTransition

      // No View Transitions support — swap instantly
      if (typeof doc.startViewTransition !== "function") {
        setTheme(nextTheme)
        return
      }

      // Expand the new theme as a circle from the exact click coordinates
      const x = event.clientX
      const y = event.clientY
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      )

      const transition = doc.startViewTransition(() => {
        flushSync(() => {
          setTheme(nextTheme)
        })
      })

      await transition.ready

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      )
    },
    [resolvedTheme, setTheme, duration],
  )

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={toggleTheme}
      className={cn(
        // Matches the fullscreen button styling so the pair reads as one cluster
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-teal-500",
        className,
      )}
      {...props}
    >
      {/* CSS-driven swap (no hydration flash): sun shows in light, moon in dark */}
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}

export default AnimatedThemeToggler
