/**
 * Unit tests for the smart edge router (components/board/edges/edge-routing.ts).
 * Recreates the exact 6-node scenario from the user's reference image:
 *
 *   A (top-left)  B (middle, blocks the A→X corridor)  X (top-right)
 *   C (left, isolated)   D (center)   E (bottom-left)
 *
 *   edges: A→B, A→X, A→D, D→A, D→E
 *
 * Run with: bun scripts/test-edge-router.ts
 */
import {
  routeEdge,
  roundedPath,
  type Box,
  type EdgeRef,
  type RouteResult,
} from "../components/board/edges/edge-routing"

let failures = 0
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ok  ${msg}`)
  } else {
    failures++
    console.error(`FAIL  ${msg}`)
  }
}

function segHitsRect(a: any, b: any, r: any): boolean {
  let t0 = 0
  let t1 = 1
  const dx = b.x - a.x
  const dy = b.y - a.y
  const p = [-dx, dx, -dy, dy]
  const q = [a.x - r.x, r.x + r.width - a.x, a.y - r.y, r.y + r.height - a.y]
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false
    } else {
      const t = q[i] / p[i]
      if (p[i] < 0) {
        if (t > t1) return false
        if (t > t0) t0 = t
      } else {
        if (t < t0) return false
        if (t < t1) t1 = t
      }
    }
  }
  return t1 > t0
}

const shrink = (r: any, p: number) => ({ x: r.x + p, y: r.y + p, width: r.width - 2 * p, height: r.height - 2 * p })

/** No route segment may pass through any node (1px tolerance at endpoints). */
function assertAvoidsNodes(name: string, route: RouteResult, boxes: Box[], sourceId: string, targetId: string) {
  const pts = route.points
  let clean = true
  for (let i = 0; i + 1 < pts.length; i++) {
    for (const box of boxes) {
      const isOwn = box.id === sourceId || box.id === targetId
      const isStub = i === 0 || i === pts.length - 2
      if (isOwn && isStub) continue // anchors legitimately touch their own box
      const rect = isOwn ? shrink(box.rect, 1) : box.rect
      if (segHitsRect(pts[i], pts[i + 1], rect)) {
        clean = false
        console.error(`      segment ${i} (${JSON.stringify(pts[i])}→${JSON.stringify(pts[i + 1])}) hits ${box.id}`)
      }
    }
  }
  assert(clean, `${name}: path avoids every node body`)
}

function minDistBetweenRoutes(a: RouteResult, b: RouteResult): number {
  let best = Infinity
  const segDist = (p: any, q: any, r: any, s: any): number => {
    const d = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
      const abx = bx - ax
      const aby = by - ay
      const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1)))
      return Math.hypot(px - (ax + abx * t), py - (ay + aby * t))
    }
    // crude but fine: point-to-segment both ways (segments here are axis-aligned)
    return Math.min(d(p.x, p.y, r.x, r.y, s.x, s.y), d(q.x, q.y, r.x, r.y, s.x, s.y), d(r.x, r.y, p.x, p.y, q.x, q.y), d(s.x, s.y, p.x, p.y, q.x, q.y))
  }
  for (let i = 0; i + 1 < a.points.length; i++) {
    for (let j = 0; j + 1 < b.points.length; j++) {
      best = Math.min(best, segDist(a.points[i], a.points[i + 1], b.points[j], b.points[j + 1]))
    }
  }
  return best
}

/** Detect parallel overlap (the ugly artifact) between two routes. */
function hasParallelOverlap(a: RouteResult, b: RouteResult, minGap = 6): boolean {
  const isH = (p: any, q: any) => Math.abs(p.y - q.y) < 0.1
  const isV = (p: any, q: any) => Math.abs(p.x - q.x) < 0.1
  for (let i = 0; i + 1 < a.points.length; i++) {
    for (let j = 0; j + 1 < b.points.length; j++) {
      const p1 = a.points[i]
      const p2 = a.points[i + 1]
      const q1 = b.points[j]
      const q2 = b.points[j + 1]
      if (isH(p1, p2) && isH(q1, q2)) {
        const xOverlap = Math.min(p1.x, p2.x, q1.x, q2.x) !== Math.max(p1.x, p2.x, q1.x, q2.x) &&
          Math.max(Math.min(p1.x, p2.x), Math.min(q1.x, q2.x)) <= Math.min(Math.max(p1.x, p2.x), Math.max(q1.x, q2.x))
        if (xOverlap && Math.abs(p1.y - q1.y) < minGap) return true
      }
      if (isV(p1, p2) && isV(q1, q2)) {
        const yOverlap = Math.max(Math.min(p1.y, p2.y), Math.min(q1.y, q2.y)) <= Math.min(Math.max(p1.y, p2.y), Math.max(q1.y, q2.y))
        if (yOverlap && Math.abs(p1.x - q1.x) < minGap) return true
      }
      // perpendicular crossing is fine — that's an ordinary X crossing
    }
  }
  return false
}

function routesCross(a: RouteResult, b: RouteResult): boolean {
  const orient = (p: any, q: any, r: any) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  const onSeg = (p: any, q: any, r: any) =>
    Math.min(p.x, q.x) - 0.01 <= r.x && r.x <= Math.max(p.x, q.x) + 0.01 && Math.min(p.y, q.y) - 0.01 <= r.y && r.y <= Math.max(p.y, q.y) + 0.01
  const segCross = (p1: any, p2: any, q1: any, q2: any) => {
    const o1 = orient(p1, p2, q1)
    const o2 = orient(p1, p2, q2)
    const o3 = orient(q1, q2, p1)
    const o4 = orient(q1, q2, p2)
    if (o1 !== o2 && o3 !== o4) return true
    if (o1 === 0 && onSeg(p1, p2, q1)) return true
    if (o2 === 0 && onSeg(p1, p2, q2)) return true
    if (o3 === 0 && onSeg(q1, q2, p1)) return true
    if (o4 === 0 && onSeg(q1, q2, p2)) return true
    return false
  }
  for (let i = 0; i + 1 < a.points.length; i++) {
    for (let j = 0; j + 1 < b.points.length; j++) {
      if (segCross(a.points[i], a.points[i + 1], b.points[j], b.points[j + 1])) return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Scenario from the reference image
// ---------------------------------------------------------------------------

const boxes: Box[] = [
  { id: "A", rect: { x: 100, y: 80, width: 140, height: 56 } },
  { id: "B", rect: { x: 340, y: 96, width: 140, height: 56 } },
  { id: "X", rect: { x: 600, y: 80, width: 140, height: 56 } },
  { id: "C", rect: { x: 100, y: 300, width: 140, height: 56 } },
  { id: "D", rect: { x: 380, y: 300, width: 140, height: 56 } },
  { id: "E", rect: { x: 80, y: 480, width: 140, height: 56 } },
]

const edges: EdgeRef[] = [
  { id: "eAB", source: "A", target: "B" },
  { id: "eAX", source: "A", target: "X" },
  { id: "eAD", source: "A", target: "D" },
  { id: "eDA", source: "D", target: "A" },
  { id: "eDE", source: "D", target: "E" },
]

console.log("\n== scenario: reference image (A,B,X,C,D,E) ==")
const routes = new Map<string, RouteResult>()
for (const e of edges) {
  const r = routeEdge({ edgeId: e.id, sourceId: e.source, targetId: e.target, boxes, edges })
  assert(r !== null, `${e.id}: routed`)
  if (r) {
    routes.set(e.id, r)
    console.log(`      ${e.id}: sides ${r.sourceSide}→${r.targetSide}, pts ${JSON.stringify(r.points)}`)
    console.log(`      ${e.id}: path "${roundedPath(r.points)}"`)
  }
}

const R = (id: string) => routes.get(id) as RouteResult

console.log("\n-- every edge avoids every node body --")
for (const e of edges) {
  const r = routes.get(e.id)
  if (r) assertAvoidsNodes(e.id, r, boxes, e.source, e.target)
}

console.log("\n-- problem 3: A→X must go over the top of B --")
{
  const r = R("eAX")
  assert(r.sourceSide === "top" && r.targetSide === "top", `eAX uses top/top (got ${r.sourceSide}/${r.targetSide})`)
  const minY = Math.min(...r.points.map((p) => p.y))
  assert(minY <= 96 - 12, `eAX passes above B with clearance (minY=${minY}, B.top=96)`)
}

console.log("\n-- problem 1: A→D and D→A keep a visible gap (no overlap) --")
{
  const ad = R("eAD")
  const da = R("eDA")
  assert(!hasParallelOverlap(ad, da, 10), "eAD vs eDA: no parallel overlap closer than 10px")
  const d = minDistBetweenRoutes(ad, da)
  assert(d >= 10, `eAD vs eDA min distance ${d.toFixed(1)}px >= 10`)
  assert(!routesCross(ad, da), "eAD vs eDA do not cross each other")
}

console.log("\n-- problem 2: D→A and D→E must not cross --")
{
  const da = R("eDA")
  const de = R("eDE")
  assert(!routesCross(da, de), "eDA vs eDE do not cross")
}

console.log("\n-- no parallel overlaps anywhere --")
{
  const ids = edges.map((e) => e.id)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = R(ids[i])
      const b = R(ids[j])
      assert(!hasParallelOverlap(a, b, 8), `${ids[i]} vs ${ids[j]}: no parallel overlap < 8px`)
    }
  }
}

console.log("\n-- determinism --")
{
  const again = routeEdge({ edgeId: "eAD", sourceId: "A", targetId: "D", boxes, edges })
  assert(JSON.stringify(again) === JSON.stringify(R("eAD")), "re-routing eAD yields the identical result")
}

// ---------------------------------------------------------------------------
// Extra sanity scenarios
// ---------------------------------------------------------------------------

console.log("\n== scenario: plain two-node horizontal link ==")
{
  const b2: Box[] = [
    { id: "n1", rect: { x: 0, y: 0, width: 140, height: 56 } },
    { id: "n2", rect: { x: 400, y: 0, width: 140, height: 56 } },
  ]
  const e2: EdgeRef[] = [{ id: "e1", source: "n1", target: "n2" }]
  const r = routeEdge({ edgeId: "e1", sourceId: "n1", targetId: "n2", boxes: b2, edges: e2 })
  assert(r !== null && r.points.length === 2, `straight link collapses to a 2-point line (got ${r?.points.length})`)
  assert(r!.sourceSide === "right" && r!.targetSide === "left", "uses right → left")
}

console.log("\n== scenario: bidirectional pair, vertically aligned ==")
{
  const b3: Box[] = [
    { id: "n1", rect: { x: 200, y: 0, width: 140, height: 56 } },
    { id: "n2", rect: { x: 200, y: 400, width: 140, height: 56 } },
  ]
  const e3: EdgeRef[] = [
    { id: "down", source: "n1", target: "n2" },
    { id: "up", source: "n2", target: "n1" },
  ]
  const r1 = routeEdge({ edgeId: "down", sourceId: "n1", targetId: "n2", boxes: b3, edges: e3 })
  const r2 = routeEdge({ edgeId: "up", sourceId: "n2", targetId: "n1", boxes: b3, edges: e3 })
  assert(r1 !== null && r2 !== null, "both routed")
  const xLane = (r: any) => r.points[0].x
  const gap = Math.abs(xLane(r1!) - xLane(r2!))
  assert(gap >= 14, `vertical lanes separated by ${gap}px (>= 14)`)
  assert(r1!.points.length === 2 && r2!.points.length === 2, "both are straight vertical lines")
}

console.log("\n== scenario: bidirectional pair, offset targets (Z corridors) ==")
{
  const b3b: Box[] = [
    { id: "n1", rect: { x: 200, y: 0, width: 140, height: 56 } },
    { id: "n2", rect: { x: 360, y: 400, width: 140, height: 56 } },
  ]
  const e3b: EdgeRef[] = [
    { id: "down", source: "n1", target: "n2" },
    { id: "up", source: "n2", target: "n1" },
  ]
  const r1 = routeEdge({ edgeId: "down", sourceId: "n1", targetId: "n2", boxes: b3b, edges: e3b })
  const r2 = routeEdge({ edgeId: "up", sourceId: "n2", targetId: "n1", boxes: b3b, edges: e3b })
  assert(r1 !== null && r2 !== null, "both routed")
  if (r1 && r2) {
    console.log(`      down: ${JSON.stringify(r1.points)}`)
    console.log(`      up:   ${JSON.stringify(r2.points)}`)
    assert(!hasParallelOverlap(r1, r2, 8), "no parallel overlap between the two directions")
    assert(!routesCross(r1, r2), "the two directions do not interweave")
    const midY1 = r1.points[2]?.y
    const midY2 = r2.points[2]?.y
    if (midY1 !== undefined && midY2 !== undefined) {
      assert(Math.abs(midY1 - midY2) >= 14, `corridor lanes separated by ${Math.abs(midY1 - midY2)}px (>= 14)`)
    }
  }
}

console.log("\n== scenario: detour around an obstacle (A* fallback) ==")
{
  // n1 → n2 with a wall of nodes blocking every straight corridor.
  const b4: Box[] = [
    { id: "n1", rect: { x: 0, y: 200, width: 140, height: 56 } },
    { id: "n2", rect: { x: 600, y: 200, width: 140, height: 56 } },
    { id: "w1", rect: { x: 300, y: 60, width: 140, height: 56 } },
    { id: "w2", rect: { x: 300, y: 150, width: 140, height: 56 } },
    { id: "w3", rect: { x: 300, y: 240, width: 140, height: 56 } },
    { id: "w4", rect: { x: 300, y: 330, width: 140, height: 56 } },
  ]
  const e4: EdgeRef[] = [{ id: "e1", source: "n1", target: "n2" }]
  const r = routeEdge({ edgeId: "e1", sourceId: "n1", targetId: "n2", boxes: b4, edges: e4 })
  assert(r !== null, "routed around the wall")
  if (r) assertAvoidsNodes("e1 (wall)", r, b4, "n1", "n2")
}

console.log("\n== scenario: L-shaped neighbor (perpendicular) ==")
{
  const b5: Box[] = [
    { id: "n1", rect: { x: 0, y: 0, width: 140, height: 56 } },
    { id: "n2", rect: { x: 40, y: 300, width: 140, height: 56 } },
  ]
  const e5: EdgeRef[] = [{ id: "e1", source: "n1", target: "n2" }]
  const r = routeEdge({ edgeId: "e1", sourceId: "n1", targetId: "n2", boxes: b5, edges: e5 })
  assert(r !== null, "routed")
  if (r) assertAvoidsNodes("e1 (L)", r, b5, "n1", "n2")
}

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
