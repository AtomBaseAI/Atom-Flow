/**
 * Orthogonal edge-routing engine behind the board's SmartEdge.
 *
 * Given every node's bounding box and the board's edge list, `routeEdge`
 * decides:
 *
 *  1. WHICH sides of the source/target boxes the edge should attach to.
 *     16 side combinations are scored geometrically — a combination whose
 *     naive orthogonal route would pass through another node (or fold back
 *     through its own endpoints) is heavily penalised, so e.g. an edge whose
 *     straight corridor is blocked by a middle node reroutes over/under it
 *     instead (A top + X top when B sits between them).
 *
 *  2. HOW parallel edges share the same border. Edges attaching to the same
 *     node side are spread evenly along that border (sorted by where their
 *     far end sits), and the free "corridor" lane of head-on routes is
 *     shifted by the average of the two endpoint offsets — so an A→D / D→A
 *     pair renders as two parallel lines with a constant gap instead of
 *     overlapping.
 *
 *  3. THE PATH between the anchors. When the naive route is clean it is used
 *     directly (fast path, same shape as before). Otherwise a coarse-grid A*
 *     finds an orthogonal detour around the obstacles (inflated by a margin),
 *     which keeps edges from cutting through unrelated nodes.
 *
 * Everything here is pure geometry (no React, no store) so it can be unit
 * tested directly.
 */

export type Side4 = "top" | "right" | "bottom" | "left"

export interface Pt {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Box {
  id: string
  rect: Rect
}

export interface EdgeRef {
  id: string
  source: string
  target: string
}

export interface Sides {
  source: Side4
  target: Side4
}

export interface RouteResult {
  /** Polyline from the source anchor to the target anchor (already simplified). */
  points: Pt[]
  sourceSide: Side4
  targetSide: Side4
}

// Arrows float this far outside the node border (matches the previous look).
export const ANCHOR_GAP = 10
// Straight run after the anchor before the router starts bending.
const STUB = 16
// Minimum breathing room kept around obstacle nodes.
const OBSTACLE_PAD = 14
// Gap between edges bundled onto the same border / corridor.
const LANE_SPACING = 18
// Minimum clearance between two edge anchors that run parallel approaches.
const ANCHOR_CLEAR = LANE_SPACING / 2
// Corner radius of the drawn path.
const CORNER_RADIUS = 8
// How strongly a stub direction disagreeing with the straight line toward the
// other node is penalised (drives "natural" side choice on ties).
const FACING_WEIGHT = 28
const SAME_SIDE_PENALTY = 40
const BLOCKED_PENALTY = 1e6
// How many side combos are worth an A* detour when everything is blocked.
const ASTAR_CANDIDATES = 3

const OUTWARD: Record<Side4, Pt> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

const SIDE_ORDER: Side4[] = ["top", "right", "bottom", "left"]

// ---------------------------------------------------------------------------
// Small geometry helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function inflateRect(r: Rect, p: number): Rect {
  return { x: r.x - p, y: r.y - p, width: r.width + 2 * p, height: r.height + 2 * p }
}

function shrinkRect(r: Rect, p: number): Rect {
  return { x: r.x + p, y: r.y + p, width: Math.max(1, r.width - 2 * p), height: Math.max(1, r.height - 2 * p) }
}

export function rectCenter(r: Rect): Pt {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

/** Point on the box border for `side`, slid `along` px parallel to that side. */
export function borderPoint(rect: Rect, side: Side4, along = 0): Pt {
  switch (side) {
    case "top":
      return { x: rect.x + rect.width / 2 + along, y: rect.y }
    case "bottom":
      return { x: rect.x + rect.width / 2 + along, y: rect.y + rect.height }
    case "left":
      return { x: rect.x, y: rect.y + rect.height / 2 + along }
    case "right":
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 + along }
  }
}

/** Anchor = border point pushed `ANCHOR_GAP` px outside the box. */
export function anchorPoint(rect: Rect, side: Side4, along = 0): Pt {
  const b = borderPoint(rect, side, along)
  const d = OUTWARD[side]
  return { x: b.x + d.x * ANCHOR_GAP, y: b.y + d.y * ANCHOR_GAP }
}

/** Liang–Barsky segment vs rect intersection (strict overlap). */
export function segHitsRect(a: Pt, b: Pt, r: Rect): boolean {
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

function polylineHits(pts: Pt[], rects: Rect[]): boolean {
  for (let i = 0; i + 1 < pts.length; i++) {
    for (const r of rects) {
      if (segHitsRect(pts[i], pts[i + 1], r)) return true
    }
  }
  return false
}

function polyLength(pts: Pt[]): number {
  let len = 0
  for (let i = 0; i + 1 < pts.length; i++) {
    len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
  }
  return len
}

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) out.push(p)
  }
  return out
}

/** Merge collinear segments so routes stay tidy. */
export function simplifyPath(pts: Pt[]): Pt[] {
  const src = dedupe(pts)
  if (src.length < 3) return src
  const out: Pt[] = [src[0]]
  for (let i = 1; i < src.length - 1; i++) {
    const a = out[out.length - 1]
    const b = src[i]
    const c = src[i + 1]
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)
    // Collinear (cross ≈ 0). Keep the point on direction reversals (dot < 0)
    // so folded routes don't get flattened into a straight overlap.
    if (Math.abs(cross) < 0.01 && dot >= 0) continue
    out.push(b)
  }
  out.push(src[src.length - 1])
  return out
}

// ---------------------------------------------------------------------------
// Naive orthogonal route for a side combination
// ---------------------------------------------------------------------------

/**
 * Builds the classic orthogonal connector between two anchors:
 * stub out of the source, bend toward the target, stub into the target.
 * `midShift` slides the free corridor lane (head-on / same-direction shapes)
 * sideways so parallel edges can occupy distinct lanes.
 */
export function simpleRoute(p0: Pt, d0: Pt, p3: Pt, d3: Pt, stub = STUB, midShift = 0): Pt[] {
  const s0 = { x: p0.x + d0.x * stub, y: p0.y + d0.y * stub }
  const s1 = { x: p3.x + d3.x * stub, y: p3.y + d3.y * stub }
  const pts: Pt[] = [p0, s0]
  const h0 = d0.x !== 0
  const h3 = d3.x !== 0

  if (h0 && h3) {
    if (d0.x === -d3.x) {
      // Head-on (e.g. right → left): straight lane when aligned, Z-bend else.
      const forward = d0.x > 0 ? s0.x <= s1.x : s0.x >= s1.x
      if (forward) {
        if (Math.abs(s0.y - s1.y) < 0.5) {
          pts.push(s1)
        } else {
          const mx = (s0.x + s1.x) / 2 + midShift
          pts.push({ x: mx, y: s0.y }, { x: mx, y: s1.y }, s1)
        }
      } else {
        const mx = d0.x > 0 ? Math.max(s0.x, s1.x) + stub : Math.min(s0.x, s1.x) - stub
        pts.push({ x: mx, y: s0.y }, { x: mx, y: s1.y }, s1)
      }
    } else {
      // Same direction: swing around the far side (S/U shape).
      const mx = d0.x > 0 ? Math.max(s0.x, s1.x) + stub : Math.min(s0.x, s1.x) - stub
      pts.push({ x: mx, y: s0.y }, { x: mx, y: s1.y }, s1)
    }
  } else if (!h0 && !h3) {
    if (d0.y === -d3.y) {
      const forward = d0.y > 0 ? s0.y <= s1.y : s0.y >= s1.y
      if (forward) {
        if (Math.abs(s0.x - s1.x) < 0.5) {
          pts.push(s1)
        } else {
          const my = (s0.y + s1.y) / 2 + midShift
          pts.push({ x: s0.x, y: my }, { x: s1.x, y: my }, s1)
        }
      } else {
        const my = d0.y > 0 ? Math.max(s0.y, s1.y) + stub : Math.min(s0.y, s1.y) - stub
        pts.push({ x: s0.x, y: my }, { x: s1.x, y: my }, s1)
      }
    } else {
      const my = d0.y > 0 ? Math.max(s0.y, s1.y) + stub : Math.min(s0.y, s1.y) - stub
      pts.push({ x: s0.x, y: my }, { x: s1.x, y: my }, s1)
    }
  } else {
    // Perpendicular stubs: single elbow where they meet.
    pts.push(h0 ? { x: s1.x, y: s0.y } : { x: s0.x, y: s1.y }, s1)
  }

  pts.push(p3)
  return simplifyPath(pts)
}

// ---------------------------------------------------------------------------
// Side selection
// ---------------------------------------------------------------------------

interface RankedCombo {
  source: Side4
  target: Side4
  score: number
  /** Naive route is free of obstacle hits. */
  clean: boolean
}

function rankCombos(srcRect: Rect, tgtRect: Rect, othersInf: Rect[], ownShrunk: Rect[]): RankedCombo[] {
  const sc = rectCenter(srcRect)
  const tc = rectCenter(tgtRect)
  const dxc = tc.x - sc.x
  const dyc = tc.y - sc.y
  const distC = Math.hypot(dxc, dyc) || 1
  const toT = { x: dxc / distC, y: dyc / distC }
  const toS = { x: -toT.x, y: -toT.y }

  const combos: RankedCombo[] = []
  for (const ss of SIDE_ORDER) {
    for (const ts of SIDE_ORDER) {
      const a0 = anchorPoint(srcRect, ss)
      const a3 = anchorPoint(tgtRect, ts)
      const pts = simpleRoute(a0, OUTWARD[ss], a3, OUTWARD[ts])
      let score = polyLength(pts)
      const clean =
        !polylineHits(pts, othersInf) && !polylineHits(pts.slice(1, -1), ownShrunk)
      if (!clean) score += BLOCKED_PENALTY
      const d0 = OUTWARD[ss]
      const d3 = OUTWARD[ts]
      score += (1 - (d0.x * toT.x + d0.y * toT.y)) * FACING_WEIGHT
      score += (1 - (d3.x * toS.x + d3.y * toS.y)) * FACING_WEIGHT
      if (ss === ts) score += SAME_SIDE_PENALTY
      // Deterministic tie-break; "top" is checked first so an over-the-top
      // detour wins an otherwise tied reroute (matches expectations when a
      // middle node blocks the direct corridor).
      score += (SIDE_ORDER.indexOf(ss) + SIDE_ORDER.indexOf(ts)) * 0.01
      combos.push({ source: ss, target: ts, score, clean })
    }
  }
  combos.sort((a, b) => a.score - b.score)
  return combos
}

export function chooseSides(srcRect: Rect, tgtRect: Rect, othersInf: Rect[], ownShrunk: Rect[]): Sides {
  const best = rankCombos(srcRect, tgtRect, othersInf, ownShrunk)[0]
  return { source: best.source, target: best.target }
}

// ---------------------------------------------------------------------------
// Bundling: spread edges that share a node border onto distinct lanes
// ---------------------------------------------------------------------------

/** Along-border span available for anchor sliding. */
function halfFor(rect: Rect, side: Side4): number {
  const span = side === "top" || side === "bottom" ? rect.width : rect.height
  return Math.max(0, span / 2 - 12)
}

/** Absolute coordinate of an anchor along its border axis. */
function borderV(rect: Rect, side: Side4, along: number): number {
  const b = borderPoint(rect, side, along)
  return side === "top" || side === "bottom" ? b.x : b.y
}

/**
 * Offset (px, along the border) for this edge's attachment on `nodeId`/`side`.
 * All edges attaching to the same border are sorted by where their far end
 * sits (edge id as tie-break) and spread apart (compressed if the border is
 * too small for the full spacing). Bidirectional pairs therefore get
 * symmetric ±lanes on both ends.
 */
function attachmentOffset(
  selfId: string,
  nodeId: string,
  side: Side4,
  edges: EdgeRef[],
  boxById: Map<string, Box>,
  sidesFor: (e: EdgeRef) => Sides,
): number {
  const box = boxById.get(nodeId)
  if (!box) return 0
  const axis: "x" | "y" = side === "top" || side === "bottom" ? "x" : "y"
  const peers: { id: string; key: number }[] = []
  for (const e of edges) {
    const s = sidesFor(e)
    let role: "source" | "target" | null = null
    if (e.source === nodeId && s.source === side) role = "source"
    else if (e.target === nodeId && s.target === side) role = "target"
    if (!role) continue
    const otherId = role === "source" ? e.target : e.source
    const other = boxById.get(otherId)
    const oc = other ? rectCenter(other.rect) : { x: 0, y: 0 }
    peers.push({ id: e.id, key: axis === "x" ? oc.x : oc.y })
  }
  if (peers.length === 0) return 0
  peers.sort((a, b) => a.key - b.key || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const idx = peers.findIndex((p) => p.id === selfId)
  if (idx < 0) return 0
  // Keep the anchor on the border segment; compress the ladder when the
  // border cannot fit the full spacing.
  const half = halfFor(box.rect, side)
  const spacing = peers.length > 1 ? Math.min(LANE_SPACING, (2 * half) / (peers.length - 1)) : LANE_SPACING
  const raw = (idx - (peers.length - 1) / 2) * spacing
  return clamp(raw, -half, half)
}

// ---------------------------------------------------------------------------
// Anchor de-confliction for parallel final approaches
// ---------------------------------------------------------------------------

function intervalsOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1]
}

/** u-range spanned by an edge's corridor between its anchor node and far node. */
function corridorBand(edge: EdgeRef, anchorNodeId: string, side: Side4, boxById: Map<string, Box>): [number, number] {
  const horizontalCorridor = side === "left" || side === "right"
  const farId = edge.source === anchorNodeId ? edge.target : edge.source
  const a = boxById.get(anchorNodeId)
  const b = boxById.get(farId)
  if (!a || !b) return [Infinity, -Infinity]
  const lo = horizontalCorridor ? (r: Rect) => r.x : (r: Rect) => r.y
  const hi = horizontalCorridor ? (r: Rect) => r.x + r.width : (r: Rect) => r.y + r.height
  return [Math.min(lo(a.rect), lo(b.rect)) - ANCHOR_GAP, Math.max(hi(a.rect), hi(b.rect)) + ANCHOR_GAP]
}

/**
 * Final approach segments into left/right borders run horizontally at the
 * anchor's y (into top/bottom borders: vertically at its x). When two edges
 * anchor at nearly the same coordinate on such borders and their corridors
 * overlap, their approaches would render as one merged line. This slides own
 * anchor along its border to the nearest clear slot. Deterministic from both
 * sides: the edge with more sliding headroom (ties: higher id) is the one
 * that moves, and everyone evaluates conflicts against original offsets.
 */
function deconflictAnchor(
  self: EdgeRef,
  nodeId: string,
  side: Side4,
  off: number,
  edges: EdgeRef[],
  boxById: Map<string, Box>,
  sidesFor: (e: EdgeRef) => Sides,
  offsetsFor: (e: EdgeRef) => { source: number; target: number },
): number {
  const box = boxById.get(nodeId)
  if (!box) return off
  const axis: "x" | "y" = side === "top" || side === "bottom" ? "x" : "y"
  const myV = borderV(box.rect, side, off)
  const myBand = corridorBand(self, nodeId, side, boxById)
  const myHeadroom = halfFor(box.rect, side) - Math.abs(off)

  const conflicts: { id: string; v: number; headroom: number }[] = []
  for (const peer of edges) {
    if (peer.id === self.id) continue
    const ps = sidesFor(peer)
    const pOffs = offsetsFor(peer)
    const attachments: [string, Side4, number][] = [
      [peer.source, ps.source, pOffs.source],
      [peer.target, ps.target, pOffs.target],
    ]
    for (const [pNode, pSide, pOff] of attachments) {
      const pAxis: "x" | "y" = pSide === "top" || pSide === "bottom" ? "x" : "y"
      if (pAxis !== axis) continue
      const pBox = boxById.get(pNode)
      if (!pBox) continue
      const pv = borderV(pBox.rect, pSide, pOff)
      if (Math.abs(pv - myV) >= ANCHOR_CLEAR) continue
      if (!intervalsOverlap(myBand, corridorBand(peer, pNode, pSide, boxById))) continue
      conflicts.push({ id: peer.id, v: pv, headroom: halfFor(pBox.rect, pSide) - Math.abs(pOff) })
    }
  }
  if (conflicts.length === 0) return off

  const mustMove = conflicts.some(
    (c) => myHeadroom > c.headroom || (myHeadroom === c.headroom && self.id > c.id),
  )
  if (!mustMove) return off

  const avoid = conflicts.map((c) => c.v)
  const half = halfFor(box.rect, side)
  for (let step = 1; step <= 6; step++) {
    for (const dir of [1, -1]) {
      const candidate = off + dir * step * ANCHOR_CLEAR
      if (Math.abs(candidate) > half) continue
      const cv = borderV(box.rect, side, candidate)
      if (avoid.every((v) => Math.abs(cv - v) >= ANCHOR_CLEAR)) return candidate
    }
  }
  return off
}

/**
 * Bidirectional pairs run two head-on corridors over the same span. Each
 * edge slides its corridor lane half a lane-width toward its own target so
 * the two routes become parallel lines instead of interweaving.
 */
function pairLaneShift(
  self: EdgeRef,
  sides: Sides,
  edges: EdgeRef[],
  boxById: Map<string, Box>,
  sidesFor: (e: EdgeRef) => Sides,
): number {
  const reverse = edges.find((e) => e.id !== self.id && e.source === self.target && e.target === self.source)
  if (!reverse) return 0
  // Only meaningful for head-on combos (opposite sides).
  const d0 = OUTWARD[sides.source]
  const d3 = OUTWARD[sides.target]
  if (d0.x !== -d3.x || d0.y !== -d3.y) return 0
  const rs = sidesFor(reverse)
  if (rs.source !== sides.target || rs.target !== sides.source) return 0
  const sc = rectCenter(boxById.get(self.source)!.rect)
  const tc = rectCenter(boxById.get(self.target)!.rect)
  const horizontal = sides.source === "left" || sides.source === "right"
  const dir = horizontal ? Math.sign(tc.x - sc.x) : Math.sign(tc.y - sc.y)
  return (LANE_SPACING / 2) * dir
}

// ---------------------------------------------------------------------------
// Grid A* fallback for fully blocked corridors
// ---------------------------------------------------------------------------

/**
 * Orthogonal A* on a coarse grid. Obstacles must already be inflated. Returns
 * interior waypoints from `s0` to `s1` (excluding the endpoints), or null.
 */
function astarRoute(s0: Pt, s1: Pt, obstacles: Rect[]): Pt[] | null {
  const cellBase = 16
  let minX = Math.min(s0.x, s1.x)
  let minY = Math.min(s0.y, s1.y)
  let maxX = Math.max(s0.x, s1.x)
  let maxY = Math.max(s0.y, s1.y)
  for (const o of obstacles) {
    minX = Math.min(minX, o.x)
    minY = Math.min(minY, o.y)
    maxX = Math.max(maxX, o.x + o.width)
    maxY = Math.max(maxY, o.y + o.height)
  }
  const margin = cellBase * 3
  minX -= margin
  minY -= margin
  maxX += margin
  maxY += margin

  let cell = cellBase
  let cols = Math.ceil((maxX - minX) / cell) + 1
  let rows = Math.ceil((maxY - minY) / cell) + 1
  while (cols * rows > 60000) {
    cell *= 2
    cols = Math.ceil((maxX - minX) / cell) + 1
    rows = Math.ceil((maxY - minY) / cell) + 1
  }

  const size = cols * rows
  const blocked = new Uint8Array(size)
  const cellIdx = (c: number, r: number) => r * cols + c
  for (let r = 0; r < rows; r++) {
    const y = minY + r * cell
    for (let c = 0; c < cols; c++) {
      const x = minX + c * cell
      for (const o of obstacles) {
        if (x < o.x + o.width + 2 && x + cell > o.x - 2 && y < o.y + o.height + 2 && y + cell > o.y - 2) {
          blocked[cellIdx(c, r)] = 1
          break
        }
      }
    }
  }

  const toCell = (v: number, lo: number) => clamp(Math.round((v - lo) / cell), 0, cols - 1)
  const clearNear = (p: Pt) => {
    const c0 = clamp(Math.round((p.x - minX) / cell), 0, cols - 1)
    const r0 = clamp(Math.round((p.y - minY) / cell), 0, rows - 1)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = c0 + dc
        const r = r0 + dr
        if (c >= 0 && c < cols && r >= 0 && r < rows) blocked[cellIdx(c, r)] = 0
      }
    }
  }
  clearNear(s0)
  clearNear(s1)

  const startC = toCell(s0.x, minX)
  const startR = toCell(s0.y, minY)
  const goalC = toCell(s1.x, minX)
  const goalR = toCell(s1.y, minY)
  const startIdx = cellIdx(startC, startR)
  const goalIdx = cellIdx(goalC, goalR)

  // State = cell × direction (0:+x, 1:-x, 2:+y, 3:-y).
  const DIRS: Pt[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]
  const TURN_COST = 0.4
  const states = size * 4
  const gScore = new Float64Array(states).fill(Infinity)
  const parent = new Int32Array(states).fill(-1)
  const closed = new Uint8Array(states)

  const h = (c: number, r: number) => Math.abs(c - goalC) + Math.abs(r - goalR)

  // Minimal binary heap over (f, state).
  const heapF: number[] = []
  const heapS: number[] = []
  const push = (f: number, s: number) => {
    heapF.push(f)
    heapS.push(s)
    let i = heapF.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heapF[p] <= heapF[i]) break
      ;[heapF[p], heapF[i]] = [heapF[i], heapF[p]]
      ;[heapS[p], heapS[i]] = [heapS[i], heapS[p]]
      i = p
    }
  }
  const pop = (): number => {
    const top = heapS[0]
    const lf = heapF.pop() as number
    const ls = heapS.pop() as number
    if (heapF.length > 0) {
      heapF[0] = lf
      heapS[0] = ls
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < heapF.length && heapF[l] < heapF[m]) m = l
        if (r < heapF.length && heapF[r] < heapF[m]) m = r
        if (m === i) break
        ;[heapF[m], heapF[i]] = [heapF[i], heapF[m]]
        ;[heapS[m], heapS[i]] = [heapS[i], heapS[m]]
        i = m
      }
    }
    return top
  }

  for (let d = 0; d < 4; d++) {
    gScore[startIdx * 4 + d] = 0
    push(h(startC, startR), startIdx * 4 + d)
  }

  let goalState = -1
  while (heapF.length > 0) {
    const state = pop()
    if (closed[state]) continue
    closed[state] = 1
    const cellId = Math.floor(state / 4)
    const dir = state % 4
    if (cellId === goalIdx) {
      goalState = state
      break
    }
    const c = cellId % cols
    const r = Math.floor(cellId / cols)
    const g = gScore[state]
    for (let nd = 0; nd < 4; nd++) {
      const dc = DIRS[nd].x
      const dr = DIRS[nd].y
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue
      const nCell = cellIdx(nc, nr)
      if (blocked[nCell]) continue
      const ng = g + 1 + (nd === dir ? 0 : TURN_COST)
      const nState = nCell * 4 + nd
      if (ng < gScore[nState] - 1e-9) {
        gScore[nState] = ng
        parent[nState] = state
        push(ng + h(nc, nr), nState)
      }
    }
  }

  if (goalState < 0) return null

  const rev: Pt[] = []
  let cur = goalState
  while (cur >= 0) {
    const cellId = Math.floor(cur / 4)
    const c = cellId % cols
    const r = Math.floor(cellId / cols)
    rev.push({ x: minX + c * cell, y: minY + r * cell })
    cur = parent[cur]
  }
  rev.reverse()
  // rev[0] is the start cell, rev[last] the goal cell. Align the first/last
  // interior points with the stub axes so no jog appears next to the anchor.
  const pts = rev.slice(1, -1)
  if (pts.length > 0) {
    const first = pts[0]
    const startDirIsX = Math.abs(first.x - rev[0].x) >= Math.abs(first.y - rev[0].y)
    if (startDirIsX) first.y = s0.y
    else first.x = s0.x
    const last = pts[pts.length - 1]
    const endDirIsX = Math.abs(rev[rev.length - 1].x - last.x) >= Math.abs(rev[rev.length - 1].y - last.y)
    if (endDirIsX) last.y = s1.y
    else last.x = s1.x
  }
  return simplifyPath(pts)
}

// ---------------------------------------------------------------------------
// Full per-edge routing
// ---------------------------------------------------------------------------

export interface RouteInput {
  edgeId: string
  sourceId: string
  targetId: string
  /** Every node's bounding box on the board. */
  boxes: Box[]
  /** Every edge on the board (used for lane bundling). */
  edges: EdgeRef[]
}

/**
 * Computes the smart route for one edge:
 * sides → lane offsets → path (fast naive route, A* detour as fallback).
 */
export function routeEdge(input: RouteInput): RouteResult | null {
  const { edgeId, sourceId, targetId, boxes, edges } = input
  const boxById = new Map<string, Box>()
  for (const b of boxes) boxById.set(b.id, b)
  const srcBox = boxById.get(sourceId)
  const tgtBox = boxById.get(targetId)
  if (!srcBox || !tgtBox) return null

  const sidesCache = new Map<string, Sides>()
  const sidesFor = (e: EdgeRef): Sides => {
    const hit = sidesCache.get(e.id)
    if (hit) return hit
    const a = boxById.get(e.source)
    const b = boxById.get(e.target)
    let result: Sides
    if (!a || !b || (a.rect.width <= 0 || a.rect.height <= 0 || b.rect.width <= 0 || b.rect.height <= 0)) {
      result = { source: "right", target: "left" }
    } else {
      const othersInf = boxes
        .filter((bx) => bx.id !== e.source && bx.id !== e.target)
        .map((bx) => inflateRect(bx.rect, OBSTACLE_PAD))
      const ownShrunk = [shrinkRect(a.rect, 1), shrinkRect(b.rect, 1)]
      result = chooseSides(a.rect, b.rect, othersInf, ownShrunk)
    }
    sidesCache.set(e.id, result)
    return result
  }

  const offsCache = new Map<string, { source: number; target: number }>()
  const offsetsFor = (e: EdgeRef): { source: number; target: number } => {
    const hit = offsCache.get(e.id)
    if (hit) return hit
    const s = sidesFor(e)
    const result = {
      source: attachmentOffset(e.id, e.source, s.source, edges, boxById, sidesFor),
      target: attachmentOffset(e.id, e.target, s.target, edges, boxById, sidesFor),
    }
    offsCache.set(e.id, result)
    return result
  }

  const self: EdgeRef = { id: edgeId, source: sourceId, target: targetId }
  const sides = sidesFor(self)

  // Spread on shared borders.
  const baseOffs = offsetsFor(self)
  let srcOff = baseOffs.source
  let tgtOff = baseOffs.target

  // Mirrored *perpendicular* pairs (one edge L-shaped one way, its reverse
  // the other way) interweave unless their anchor order at one shared border
  // is reversed. The border to fix is the leader edge's (smaller id) target
  // border — both edges compute the same leader, so they agree.
  const reverse = edges.find((e) => e.id !== edgeId && e.source === targetId && e.target === sourceId)
  if (reverse) {
    const rs = sidesFor(reverse)
    const mirrored = rs.source === sides.target && rs.target === sides.source
    const d0 = OUTWARD[sides.source]
    const d3 = OUTWARD[sides.target]
    const headOn = d0.x === -d3.x && d0.y === -d3.y
    const perpendicular = d0.x !== 0 !== (d3.x !== 0)
    if (mirrored && perpendicular) {
      const leader = self.id < reverse.id ? self : reverse
      const rOffs = offsetsFor(reverse)
      if (leader.id === self.id) {
        // Reverse the order at my target border (partner's source border).
        const sigma = -Math.sign(srcOff - rOffs.target || (self.id < reverse.id ? 1 : -1))
        const desired = sigma > 0 ? Math.max(tgtOff, rOffs.source) : Math.min(tgtOff, rOffs.source)
        if (desired !== tgtOff) tgtOff = desired
      } else {
        // Leader's target border is my source border: I take the slot that
        // keeps the two borders' orders opposed (leader picks the other one).
        const sigma = -Math.sign(rOffs.source - tgtOff || (reverse.id < self.id ? 1 : -1))
        const desired = sigma > 0 ? Math.min(srcOff, rOffs.target) : Math.max(srcOff, rOffs.target)
        if (desired !== srcOff) srcOff = desired
      }
    }
  }

  // Slide anchors whose parallel approaches would collide with another
  // edge's approach.
  srcOff = deconflictAnchor(self, sourceId, sides.source, srcOff, edges, boxById, sidesFor, offsetsFor)
  tgtOff = deconflictAnchor(self, targetId, sides.target, tgtOff, edges, boxById, sidesFor, offsetsFor)

  // Corridor lane: counter-shift by the endpoint spread plus the bidirectional
  // pair bias so parallel edges keep a constant gap along the whole run.
  const midShift = (srcOff - tgtOff) / 2 + pairLaneShift(self, sides, edges, boxById, sidesFor)

  const othersInf = boxes
    .filter((bx) => bx.id !== sourceId && bx.id !== targetId)
    .map((bx) => inflateRect(bx.rect, OBSTACLE_PAD))
  const ownShrunk = [shrinkRect(srcBox.rect, 1), shrinkRect(tgtBox.rect, 1)]

  const isClean = (pts: Pt[]) => !polylineHits(pts, othersInf) && !polylineHits(pts.slice(1, -1), ownShrunk)

  const buildSimple = (ss: Side4, ts: Side4, shift: number): Pt[] => {
    const a0 = anchorPoint(srcBox.rect, ss, ss === sides.source ? srcOff : 0)
    const a3 = anchorPoint(tgtBox.rect, ts, ts === sides.target ? tgtOff : 0)
    return simpleRoute(a0, OUTWARD[ss], a3, OUTWARD[ts], STUB, shift)
  }

  // 1) Fast path: first clean combo (best-scored) already avoids everything.
  //    If the full lane shift pushes the corridor into an obstacle, degrade
  //    it gracefully (half, then zero) — never flip its sign, which would
  //    re-introduce pair interweaving.
  const ranked = rankCombos(srcBox.rect, tgtBox.rect, othersInf, ownShrunk)
  for (const combo of ranked) {
    if (!combo.clean) continue
    for (const shift of [midShift, midShift / 2, 0]) {
      const pts = buildSimple(combo.source, combo.target, shift)
      if (isClean(pts)) {
        return { points: pts, sourceSide: combo.source, targetSide: combo.target }
      }
    }
  }

  // 2) Nothing clean: A* detours for the most promising combos.
  let best: { pts: Pt[]; cost: number; ss: Side4; ts: Side4 } | null = null
  for (const combo of ranked.slice(0, ASTAR_CANDIDATES)) {
    const a0 = anchorPoint(srcBox.rect, combo.source, combo.source === sides.source ? srcOff : 0)
    const a3 = anchorPoint(tgtBox.rect, combo.target, combo.target === sides.target ? tgtOff : 0)
    const s0 = { x: a0.x + OUTWARD[combo.source].x * STUB, y: a0.y + OUTWARD[combo.source].y * STUB }
    const s1 = { x: a3.x + OUTWARD[combo.target].x * STUB, y: a3.y + OUTWARD[combo.target].y * STUB }
    const astarObstacles = [...othersInf, ...ownShrunk]
    const mid = astarRoute(s0, s1, astarObstacles)
    if (!mid) continue
    const pts = simplifyPath([a0, s0, ...mid, s1, a3])
    const cost = polyLength(pts) + countTurns(pts) * 8
    if (!best || cost < best.cost) best = { pts, cost, ss: combo.source, ts: combo.target }
  }
  if (best) return { points: best.pts, sourceSide: best.ss, targetSide: best.ts }

  // 3) Last resort: best combo's naive route even if it grazes something.
  const fallback = ranked[0]
  return {
    points: buildSimple(fallback.source, fallback.target, midShift),
    sourceSide: fallback.source,
    targetSide: fallback.target,
  }
}

function countTurns(pts: Pt[]): number {
  let turns = 0
  for (let i = 1; i + 1 < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const c = pts[i + 1]
    if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) > 0.01) turns++
  }
  return turns
}

// ---------------------------------------------------------------------------
// SVG path with rounded corners
// ---------------------------------------------------------------------------

/** Renders a polyline as an SVG path with quadratic-rounded corners. */
export function roundedPath(points: Pt[], radius = CORNER_RADIUS): string {
  const f = (v: number) => {
    const r = Math.round(v * 100) / 100
    return Number.isFinite(r) ? String(r) : "0"
  }
  if (points.length === 0) return ""
  if (points.length === 1) return `M ${f(points[0].x)} ${f(points[0].y)}`
  let d = `M ${f(points[0].x)} ${f(points[0].y)}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const next = points[i + 1]
    const l1 = Math.hypot(cur.x - prev.x, cur.y - prev.y)
    const l2 = Math.hypot(next.x - cur.x, next.y - cur.y)
    if (l1 < 0.01 || l2 < 0.01) continue
    const r = Math.min(radius, l1 / 2, l2 / 2)
    const a = { x: cur.x - ((cur.x - prev.x) / l1) * r, y: cur.y - ((cur.y - prev.y) / l1) * r }
    const b = { x: cur.x + ((next.x - cur.x) / l2) * r, y: cur.y + ((next.y - cur.y) / l2) * r }
    d += ` L ${f(a.x)} ${f(a.y)} Q ${f(cur.x)} ${f(cur.y)} ${f(b.x)} ${f(b.y)}`
  }
  const last = points[points.length - 1]
  d += ` L ${f(last.x)} ${f(last.y)}`
  return d
}
