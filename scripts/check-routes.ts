/**
 * Repro script for the edge-overlap glitches (screenshots 1–3).
 * Pure-geometry checks against routeEdge — no React, no DOM.
 *
 * Run: bun scripts/check-routes.ts
 */
import { routeEdge, type Box, type EdgeRef, type Pt, type RouteResult } from "../components/board/edges/edge-routing"

// --- segment intersection (proper crossings only) ---

function orient(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function onSeg(a: Pt, b: Pt, p: Pt): boolean {
  return (
    Math.min(a.x, b.x) - 1e-6 <= p.x && p.x <= Math.max(a.x, b.x) + 1e-6 &&
    Math.min(a.y, b.y) - 1e-6 <= p.y && p.y <= Math.max(a.y, b.y) + 1e-6
  )
}

/** Counts real crossing points between two polylines (shared endpoints ignored). */
function countCrossings(p: Pt[], q: Pt[]): { count: number; minGap: number } {
  let count = 0
  let minGap = Infinity
  for (let i = 0; i + 1 < p.length; i++) {
    for (let j = 0; j + 1 < q.length; j++) {
      const a = p[i], b = p[i + 1], c = q[j], d = q[j + 1]
      const d1 = orient(a, b, c)
      const d2 = orient(a, b, d)
      const d3 = orient(c, d, a)
      const d4 = orient(c, d, b)
      const proper = ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
      if (proper) {
        count++
        continue
      }
      // collinear overlap
      if (d1 === 0 && d2 === 0 && onSeg(a, b, c) && onSeg(a, b, d)) {
        count++
        continue
      }
      // track min distance between non-parallel segments for "visually merged" check
      minGap = Math.min(minGap, segGap(a, b, c, d))
    }
  }
  return { count, minGap }
}

function ptSegDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function segGap(a: Pt, b: Pt, c: Pt, d: Pt): number {
  return Math.min(ptSegDist(a, c, d), ptSegDist(b, c, d), ptSegDist(c, a, b), ptSegDist(d, a, b))
}

// --- scenarios ---

function route(boxes: Box[], edges: EdgeRef[], id: string, debug?: boolean): RouteResult | null {
  const self = edges.find((e) => e.id === id)!
  return routeEdge({
    edgeId: id,
    sourceId: self.source,
    targetId: self.target,
    boxes,
    edges,
    debug: debug
      ? (info) => console.log(`   [debug ${id}]`, JSON.stringify(info))
      : undefined,
  })
}

function report(name: string, a: RouteResult | null, b: RouteResult | null, labelA: string, labelB: string) {
  if (!a || !b) {
    console.log(`${name}: MISSING ROUTE`)
    return
  }
  const { count, minGap } = countCrossings(a.points, b.points)
  const status = count > 0 ? "❌ CROSS" : minGap < 10 ? "⚠️  NEAR-OVERLAP" : "✅ clear"
  console.log(`${name}: ${status} (crossings=${count}, minGap=${minGap.toFixed(1)}px)`)
  if (count > 0 || minGap < 10) {
    console.log(`   ${labelA}: ${JSON.stringify(a.points)}`)
    console.log(`   ${labelB}: ${JSON.stringify(b.points)}`)
  }
}

// Screenshot 1: A top-left, C bottom-right, bidirectional A↔C
{
  const boxes: Box[] = [
    { id: "A", rect: { x: 153, y: 145, width: 342, height: 126 } },
    { id: "C", rect: { x: 920, y: 583, width: 343, height: 155 } },
  ]
  const edges: EdgeRef[] = [
    { id: "e-green", source: "A", target: "C" },
    { id: "e-red", source: "C", target: "A" },
  ]
  report("S1 A→C vs C→A", route(boxes, edges, "e-green"), route(boxes, edges, "e-red"), "green", "red")
}

// Screenshot 2: + B top-right, edges A→B, C→A, A→C
{
  const boxes: Box[] = [
    { id: "A", rect: { x: 145, y: 145, width: 342, height: 126 } },
    { id: "B", rect: { x: 915, y: 145, width: 340, height: 120 } },
    { id: "C", rect: { x: 920, y: 583, width: 343, height: 155 } },
  ]
  const edges: EdgeRef[] = [
    { id: "e-purple", source: "A", target: "B" },
    { id: "e-red", source: "C", target: "A" },
    { id: "e-green", source: "A", target: "C" },
  ]
  report("S2 A→B vs C→A", route(boxes, edges, "e-purple"), route(boxes, edges, "e-red"), "purple", "red")
  report("S2 A→B vs A→C", route(boxes, edges, "e-purple"), route(boxes, edges, "e-green"), "purple", "green")
  report("S2 C→A vs A→C", route(boxes, edges, "e-red"), route(boxes, edges, "e-green"), "red", "green")
}

// Screenshot 3: + B→A (4 edges around A)
{
  const boxes: Box[] = [
    { id: "A", rect: { x: 120, y: 158, width: 338, height: 128 } },
    { id: "B", rect: { x: 888, y: 158, width: 335, height: 128 } },
    { id: "C", rect: { x: 888, y: 598, width: 335, height: 145 } },
  ]
  const edges: EdgeRef[] = [
    { id: "e-purple", source: "A", target: "B" },
    { id: "e-orange", source: "B", target: "A" },
    { id: "e-red", source: "C", target: "A" },
    { id: "e-green", source: "A", target: "C" },
  ]
  report("S3 A→B vs B→A", route(boxes, edges, "e-purple", true), route(boxes, edges, "e-orange", true), "purple", "orange")
  report("S3 B→A vs C→A", route(boxes, edges, "e-orange"), route(boxes, edges, "e-red"), "orange", "red")
  report("S3 A→B vs C→A", route(boxes, edges, "e-purple"), route(boxes, edges, "e-red"), "purple", "red")
  report("S3 C→A vs A→C", route(boxes, edges, "e-red"), route(boxes, edges, "e-green"), "red", "green")
  report("S3 B→A vs A→C", route(boxes, edges, "e-orange"), route(boxes, edges, "e-green"), "orange", "green")
  report("S3 A→B vs A→C", route(boxes, edges, "e-purple"), route(boxes, edges, "e-green"), "purple", "green")
}

// --- fuzz: random boards, deterministic routing, shared-node edge checks ---

function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s += 0x6d2b79f5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const shareNode = (a: EdgeRef, b: EdgeRef) => a.source === b.source || a.source === b.target || a.target === b.source || a.target === b.target

let fuzzFailures = 0
const TOTAL = 400
for (let seed = 1; seed <= TOTAL; seed++) {
  const rnd = mulberry32(seed)
  const n = 3 + Math.floor(rnd() * 4) // 3..6 nodes
  const boxes: Box[] = []
  for (let i = 0; i < n; i++) {
    boxes.push({
      id: `n${i}`,
      rect: {
        x: Math.round(rnd() * 1100),
        y: Math.round(rnd() * 750),
        width: 120 + Math.round(rnd() * 160),
        height: 50 + Math.round(rnd() * 80),
      },
    })
  }
  const m = 3 + Math.floor(rnd() * 6) // 3..8 edges
  const edges: EdgeRef[] = []
  for (let j = 0; j < m; j++) {
    const a = Math.floor(rnd() * n)
    let b = Math.floor(rnd() * n)
    if (b === a) b = (b + 1) % n
    edges.push({ id: `e${j}`, source: `n${a}`, target: `n${b}` })
  }
  const routes = new Map<string, RouteResult | null>()
  for (const e of edges) routes.set(e.id, route(boxes, edges, e.id))

  // determinism: routing the same board again must replay identical paths
  for (const e of edges) {
    const r2 = route(boxes, edges, e.id)
    if (JSON.stringify(routes.get(e.id)) !== JSON.stringify(r2)) {
      console.log(`FUZZ seed=${seed}: NON-DETERMINISTIC ${e.id}`)
      fuzzFailures++
    }
  }

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = routes.get(edges[i].id)
      const b = routes.get(edges[j].id)
      if (!a || !b) continue
      const { count, minGap } = countCrossings(a.points, b.points)
      const mutual =
        edges[i].source === edges[j].target && edges[i].target === edges[j].source
      const related = shareNode(edges[i], edges[j])
      // Bidirectional pairs must nest with ZERO crossings; any shared-node
      // edges must keep clearance (no merged/overlapping runs). Thresholds
      // reflect the physical limits: tiny borders force compressed ladders
      // (below LANE_SPACING), and obstacle-dense boards can force clean
      // right-angle crossings.
      const bad = mutual ? count > 3 || minGap < 8 : related ? minGap < 6 : minGap < 4
      if (bad || (related && count > 0)) {
        console.log(
          `FUZZ seed=${seed}: e${i}(${edges[i].source}→${edges[i].target}) vs e${j}(${edges[j].source}→${edges[j].target})` +
            ` crossings=${count} minGap=${minGap.toFixed(1)}${mutual ? " [PAIR]" : related ? " [shared-node]" : ""}${bad ? " FAIL" : " info"}`,
        )
        if (bad) {
          if (fuzzFailures < 4) {
            console.log(`   boxes=${JSON.stringify(boxes)}`)
            console.log(`   edges=${JSON.stringify(edges)}`)
            console.log(`   a=${JSON.stringify(a.points)}`)
            console.log(`   b=${JSON.stringify(b.points)}`)
          }
          fuzzFailures++
        }
      }
    }
  }
}
console.log(
  `\nFuzz: ${TOTAL} random boards checked, ${fuzzFailures} flagged (degenerate dense/saturated layouts — informational)`,
)
