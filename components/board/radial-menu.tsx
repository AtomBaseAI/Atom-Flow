"use client"

import { useEffect, useMemo, useSyncExternalStore, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import type { LucideIcon } from "lucide-react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const subscribeNoop = () => () => {}

export type RadialMenuItem = {
  id: string
  label: string
  icon: LucideIcon
  /** Highlights the item (e.g. currently active tool). */
  active?: boolean
  onSelect: () => void
}

type RadialMenuProps = {
  open: boolean
  /** Screen (client) coordinates of the tap / right-click point. */
  position: { x: number; y: number } | null
  items: RadialMenuItem[]
  onClose: () => void
}

const ITEM_SIZE = 46
const RADIUS = 92
const HUB_SIZE = 54

/**
 * Animated circular (radial) context menu.
 *
 * A dashed orbit ring + center hub pop out of the tap / right-click point while
 * the action buttons fan around the circle with a springy stagger. Click/tap the
 * backdrop or the hub, or press Escape, to collapse it again.
 *
 * The menu stays mounted (invisible) between opens so every open/close is a pure
 * CSS transition — including the very first open.
 */
export default function RadialMenu({ open, position, items, onClose }: RadialMenuProps) {
  // Portal can only render in the browser — useSyncExternalStore flips after
  // hydration without a cascading setState-in-effect.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  )

  // Escape closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Keep the whole circle inside the viewport; fall back to screen center
  const origin = useMemo(() => {
    if (typeof window === "undefined") return null
    const pos = position ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const pad = RADIUS + ITEM_SIZE / 2 + 12
    if (window.innerWidth < pad * 2 || window.innerHeight < pad * 2) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    }
    return {
      x: Math.min(Math.max(pos.x, pad), window.innerWidth - pad),
      y: Math.min(Math.max(pos.y, pad), window.innerHeight - pad),
    }
  }, [position])

  if (!mounted || !origin) return null

  const step = items.length > 0 ? 360 / items.length : 360

  return createPortal(
    <div
      className={cn("radial-root fixed inset-0 z-[70]", open && "radial-open")}
      style={{ visibility: open ? "visible" : "hidden", opacity: open ? 1 : 0 }}
      role="presentation"
    >
      {/* Dimmed backdrop — click / tap anywhere to dismiss */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onPointerDown={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Menu anchored at the tap point */}
      <div
        role="menu"
        aria-label="Board actions"
        aria-hidden={!open}
        className="pointer-events-none absolute"
        style={{ left: origin.x, top: origin.y }}
      >
        {/* Soft teal glow behind the hub */}
        <div
          className="absolute rounded-full bg-teal-500/10 blur-2xl"
          style={{ width: 150, height: 150, left: -75, top: -75 }}
        />

        {/* Rotating dashed orbit ring */}
        <div
          className={cn("radial-ring absolute", open ? "radial-ring-open" : "radial-ring-closed")}
          style={{ width: RADIUS * 2, height: RADIUS * 2, left: -RADIUS, top: -RADIUS }}
        >
          <div className="radial-ring-spin absolute inset-0 rounded-full border border-dashed border-foreground/20" />
        </div>

        {/* One-shot ripple — restarts on every open */}
        <div
          className="radial-ripple absolute rounded-full border-2 border-teal-500/40"
          style={{ width: RADIUS * 2, height: RADIUS * 2, left: -RADIUS, top: -RADIUS }}
        />

        {/* Center hub = close button (stays pinned to the center) */}
        <button
          type="button"
          role="menuitem"
          aria-label="Close menu"
          tabIndex={open ? 0 : -1}
          onClick={onClose}
          className={cn(
            // NOTE: no transform/rotate/scale on hover — animating a transform on an
            // element that had backdrop-filter caused the close button to glitch while
            // hovering (Chromium compositing bug). Hover feedback = colors only.
            "radial-hub pointer-events-auto absolute flex items-center justify-center rounded-full border border-border bg-popover text-muted-foreground shadow-xl hover:border-teal-500 hover:text-foreground focus-visible:border-teal-500 focus-visible:outline-none",
            open ? "radial-hub-open" : "radial-hub-closed",
          )}
          style={{
            width: HUB_SIZE,
            height: HUB_SIZE,
            left: 0,
            top: 0,
            // Inline so the hub is ALWAYS dead-center regardless of CSS state
            transform: "translate(-50%, -50%)",
          }}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Radial action items */}
        {items.map((item, i) => {
          const angle = ((-90 + i * step) * Math.PI) / 180
          const tx = Math.cos(angle) * RADIUS
          const ty = Math.sin(angle) * RADIUS
          const Icon = item.icon
          return (
            <div
              key={item.id}
              className={cn(
                "radial-item group absolute left-0 top-0",
                open ? "radial-item-open" : "radial-item-closed",
              )}
              style={{ "--rad-x": `${tx}px`, "--rad-y": `${ty}px`, "--rad-delay": `${i * 34}ms` } as CSSProperties}
            >
              <button
                type="button"
                role="menuitem"
                aria-label={item.label}
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  onClose()
                  item.onSelect()
                }}
                className={cn(
                  // No backdrop-filter here either — scale hover + backdrop-filter
                  // flickers in Chromium. Solid bg keeps it crisp.
                  "pointer-events-auto absolute flex items-center justify-center rounded-full border bg-popover shadow-lg transition-[scale,border-color,background-color,color] duration-150 hover:scale-110 focus-visible:scale-110 focus-visible:outline-none",
                  item.active
                    ? "border-teal-500 text-teal-500 dark:text-teal-300"
                    : "border-border text-foreground hover:border-teal-500 hover:bg-accent hover:text-foreground",
                )}
                style={{ width: ITEM_SIZE, height: ITEM_SIZE, left: 0, top: 0, transform: "translate(-50%, -50%)" }}
              >
                <Icon className="h-[18px] w-[18px]" />
              </button>
              <span
                className="pointer-events-none absolute left-0 whitespace-nowrap rounded-full border border-border bg-popover/95 px-2 py-0.5 text-[10px] font-medium text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                style={{ top: ITEM_SIZE / 2 + 6, transform: "translate(-50%, 0)" }}
              >
                {item.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
