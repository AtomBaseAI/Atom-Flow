import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Apply an alpha (opacity) multiplier to any CSS color string.
 * Supports hex (#rgb, #rgba, #rrggbb, #rrggbbaa) and rgb()/rgba() forms;
 * any other format is returned untouched (browser will ignore the change).
 * "transparent" / "none" pass through unchanged so "No color" stays no color.
 */
export function withAlpha(color: string | undefined | null, alpha?: number): string {
  const a = typeof alpha === "number" ? Math.max(0, Math.min(1, alpha)) : 1
  const c = typeof color === "string" ? color.trim() : ""
  if (!c || c === "transparent" || c === "none") return c || "transparent"
  if (a >= 1) return c

  const hex = c.match(/^#([0-9a-f]{3,8})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3 || h.length === 4) h = h.split("").map((ch) => ch + ch).join("")
    if (h.length === 6) {
      const r = Number.parseInt(h.slice(0, 2), 16)
      const g = Number.parseInt(h.slice(2, 4), 16)
      const b = Number.parseInt(h.slice(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${a})`
    }
    if (h.length === 8) {
      const r = Number.parseInt(h.slice(0, 2), 16)
      const g = Number.parseInt(h.slice(2, 4), 16)
      const b = Number.parseInt(h.slice(4, 6), 16)
      const prev = Number.parseInt(h.slice(6, 8), 16) / 255
      return `rgba(${r}, ${g}, ${b}, ${prev * a})`
    }
    return c
  }

  const rgb = c.match(/^rgba?\(([^)]+)\)$/i)
  if (rgb) {
    const parts = rgb[1].split(/[,\s/]+/).filter(Boolean)
    if (parts.length >= 3) {
      const prev = parts[3] !== undefined ? Number.parseFloat(parts[3]) : 1
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${prev * a})`
    }
  }
  return c
}
