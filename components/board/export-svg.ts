"use client"

/**
 * Post-processing for the exported `.svg` file.
 *
 * html-to-image serialises the board into one standalone `<svg>` whose HTML
 * lives inside a `<foreignObject>`. Two structural facts about that pipeline
 * matter here:
 *
 *   1. Stylesheets do NOT ship with the file, and the library inlines
 *      computed styles only for HTML elements — for nested `<svg>` subtrees
 *      (every React Flow edge is its own `<svg>`) it performs a plain deep
 *      clone, so anything the board styled through a CSS class on an edge
 *      path is lost. Animated ("animated: true") edges get their dash purely
 *      from React Flow's `.react-flow__edge.animated path` rule, which is why
 *      they exported as solid lines.
 *   2. A standalone SVG has no stylesheet defining the board's theme tokens,
 *      so edges relying on `var(--af-edge)` (no explicit stroke picked) would
 *      render without a stroke.
 *
 * `decorateExportSvg` fixes both: it re-injects the animated-dash rule plus
 * its `dashdraw` keyframes (so animated edges are dashed again AND keep
 * flowing when the file is opened in a browser — SVG documents run CSS
 * animations, no scripting involved), and it resolves `--af-edge` from the
 * live board once and pins the value on the root `<svg>`, where the custom
 * property inherits into the whole subtree.
 */

const EDGE_EXPORT_CSS = `
@keyframes dashdraw {
  from { stroke-dashoffset: 10; }
}
/* Mirrors React Flow's own rule 1:1. In v12 the edge classes (including
   "animated") live on the inner <g>, not the <svg>, so the selector must be
   class-based — element-based like "svg.animated" would never match. */
.react-flow__edge.animated path {
  stroke-dasharray: 5px;
  animation: dashdraw 0.5s linear infinite;
}
/* The wide invisible hit-corridor must stay solid/static — it is transparent,
   but animating it would be wasted work (mirrors React Flow's own rule). */
.react-flow__edge.animated path.react-flow__edge-interaction {
  stroke-dasharray: none;
  animation: none;
}
`

export function decorateExportSvg(svgText: string): string {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
    const root = doc.documentElement
    if (!root || root.getElementsByTagName("parsererror").length > 0) {
      return svgText
    }

    // Resolve --af-edge from the live board so theme-dependent edge strokes
    // and arrow marker fills keep their color in the standalone file.
    try {
      const probe = document.querySelector(".react-flow") ?? document.body
      const token = getComputedStyle(probe).getPropertyValue("--af-edge").trim()
      if (token) root.style.setProperty("--af-edge", token)
    } catch {
      // Probe unavailable (should not happen in the browser) — inline strokes
      // still export correctly, only the theme-fallback color is affected.
    }

    const style = doc.createElementNS("http://www.w3.org/2000/svg", "style")
    style.textContent = EDGE_EXPORT_CSS
    root.insertBefore(style, root.firstChild)

    return new XMLSerializer().serializeToString(root)
  } catch {
    // Any parsing/serialization surprise: hand back the untouched export.
    return svgText
  }
}
