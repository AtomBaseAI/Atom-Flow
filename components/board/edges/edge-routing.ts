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
 * Stability guarantees (the "random paths" fixes):
 *
 *  - CONTAINMENT-AWARE OBSTACLES. A node that fully contains an endpoint
 *    (a group/container rectangle drawn around icon nodes, for example) is
 *    never an obstacle for that endpoint's edges — a child edge has to cross
 *    the container border, and treating the container as an obstacle used to
 *    force every side combo to score as blocked, producing squiggly A*
 *    escape paths that changed with every unrelated drag.
 *
 *  - SIDE-CHOICE HYSTERESIS. The chosen attachment sides are remembered per
 *    edge; while the remembered combo keeps a clean route it is retained
 *    unless the best combo becomes substantially shorter. Near-tied combos
 *    therefore stop flapping when an unrelated node moves.
 *
 *  - DIRECTION-CONSTRAINED A*. Detours leave the source along its stub and
 *    arrive at the target along its stub, and folded (back-and-forth)
 *    segments are pruned, so detours never render as hooks or loops at the
 *    anchors.
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
// Smallest stub-end offset that is still worth flattening into a straight
// run when the far border is otherwise unoccupied (larger dips keep their
// Z shape and get a deconflicted lane instead).
const DIP_SNAP_MAX = 30
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

/** True when `outer` fully encloses `inner` (with a small tolerance). */
export function containsRect(outer: Rect, inner: Rect, tol = 8): boolean {
  if (outer.width <= 0 || outer.height <= 0 || inner.width <= 0 || inner.height <= 0) return false
  // A container must be strictly larger than what it contains — two separate
  // nodes of the same size never contain each other.
  if (outer.width * outer.height <= inner.width * inner.height) return false
  return (
    inner.x >= outer.x - tol &&
    inner.y >= outer.y - tol &&
    inner.x + inner.width <= outer.x + outer.width + tol &&
    inner.y + inner.height <= outer.y + outer.height + tol
  )
}

/**
 * Node ids that must NOT act as obstacles for an edge between `sourceId` and
 * `targetId`. Beyond the endpoints themselves this excludes visual
 * container ancestors: a node whose rect fully contains an endpoint (e.g. a
 * "group" rectangle drawn around several icon nodes). Edges attached to a
 * container's children have to cross the container border, so treating the
 * container as an obstacle would block every side combination and produce
 * squiggly A* escape paths. Children of an endpoint stay obstacles on
 * purpose — an edge leaving a container should still detour around the
 * icons it visually passes over.
 */
function obstacleExclusionsFor(
  sourceId: string,
  targetId: string,
  boxes: Box[],
  boxById: Map<string, Box>,
): Set<string> {
  const excluded = new Set<string>([sourceId, targetId])
  const src = boxById.get(sourceId)
  const tgt = boxById.get(targetId)
  for (const bx of boxes) {
    if (excluded.has(bx.id)) continue
    if (src && containsRect(bx.rect, src.rect)) {
      excluded.add(bx.id)
      continue
    }
    if (tgt && containsRect(bx.rect, tgt.rect)) {
      excluded.add(bx.id)
    }
  }
  return excluded
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

/**
 * Cancels folded (overlapping back-and-forth) segments, e.g. a route that
 * runs right past an anchor and then doubles back over itself. Removing the
 * corner point of each fold shortens the drawn overlap while keeping the
 * exact endpoints, so detours never render as scribbles. Non-orthogonal
 * input is returned untouched.
 */
export function pruneBacktracks(pts: Pt[]): Pt[] {
  for (let i = 0; i + 1 < pts.length; i++) {
    const dx = Math.abs(pts[i + 1].x - pts[i].x)
    const dy = Math.abs(pts[i + 1].y - pts[i].y)
    if (dx > 0.01 && dy > 0.01) return pts
  }
  const out = pts.map((p) => ({ x: p.x, y: p.y }))
  let i = 1
  while (i + 1 < out.length) {
    const d1x = Math.sign(out[i].x - out[i - 1].x)
    const d1y = Math.sign(out[i].y - out[i - 1].y)
    const d2x = Math.sign(out[i + 1].x - out[i].x)
    const d2y = Math.sign(out[i + 1].y - out[i].y)
    const opposite =
      (d1x !== 0 && d2x !== 0 && d1x === -d2x) || (d1y !== 0 && d2y !== 0 && d1y === -d2y)
    if (opposite) {
      // Drop the corner; the two segments collapse into their net run.
      out.splice(i, 1)
      if (i > 1) i-- // the fold may cascade with the run before it
    } else {
      i++
    }
  }
  return simplifyPath(out)
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
      // Same direction: swing around the far side (S/U shape). The shift
      // separates same-side edges (duplicates, shared endpoints) whose swing
      // verticals would otherwise coincide exactly.
      const mx = (d0.x > 0 ? Math.max(s0.x, s1.x) + stub : Math.min(s0.x, s1.x) - stub) + midShift
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
      const my = (d0.y > 0 ? Math.max(s0.y, s1.y) + stub : Math.min(s0.y, s1.y) - stub) + midShift
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

// Temporal side-choice memory (edge id → last chosen sides). Routing the same
// edge again prefers the previously chosen combination while it still yields
// a clean route, so near-tied combos stop flapping whenever an unrelated node
// moves a fraction of a pixel. Purely a preference — a blocked or clearly
// worse remembered combo is dropped immediately.
const sidesMemory = new Map<string, Sides>()

/** How much better (relative + absolute) a new combo must be to overcome the
    stability bias of the remembered sides. */
const SWITCH_RATIO = 0.72
const SWITCH_MARGIN = 20

function pruneSidesMemory(liveEdgeIds: Set<string>) {
  // Only sweep occasionally (amortised): when the map has clearly outgrown
  // the live edge set, drop entries whose edge no longer exists.
  if (sidesMemory.size <= liveEdgeIds.size * 3 + 24) return
  for (const key of sidesMemory.keys()) {
    if (!liveEdgeIds.has(key)) sidesMemory.delete(key)
  }
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

/**
 * Picks the best side combination. When `preferred` (the previously chosen
 * sides for this edge) still routes clean it is kept unless the best clean
 * combo is substantially shorter — this hysteresis keeps edge shapes stable
 * while unrelated nodes move or during the middle of a drag.
 */
export function chooseSides(
  srcRect: Rect,
  tgtRect: Rect,
  othersInf: Rect[],
  ownShrunk: Rect[],
  preferred?: Sides,
): Sides {
  const ranked = rankCombos(srcRect, tgtRect, othersInf, ownShrunk)
  const bestClean = ranked.find((c) => c.clean)
  if (preferred) {
    const prev = ranked.find((c) => c.source === preferred.source && c.target === preferred.target)
    if (prev) {
      if (prev.clean) {
        const clearlyBetter =
          bestClean !== undefined && bestClean.score < prev.score * SWITCH_RATIO - SWITCH_MARGIN
        if (!clearlyBetter) return { source: prev.source, target: prev.target }
      } else if (bestClean) {
        // Remembered shape is now blocked — take the best clean route.
        return { source: bestClean.source, target: bestClean.target }
      } else {
        // Everything is blocked: keep the remembered shape so A* detours
        // around obstacles without flipping the attachment sides.
        return { source: prev.source, target: prev.target }
      }
    }
  }
  const pick = bestClean ?? ranked[0]
  return { source: pick.source, target: pick.target }
}

// ---------------------------------------------------------------------------
// Bundling: spread edges that share a node border onto distinct lanes
// ---------------------------------------------------------------------------

/** Along-border span available for anchor sliding. */
function halfFor(rect: Rect, side: Side4): number {
  const span = side === "top" || side === "bottom" ? rect.width : rect.height
  return Math.max(0, span / 2 - 12)
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
// Anchor assignment: border ladders + bidirectional-pair straightening
// ---------------------------------------------------------------------------

/**
 * Number of OTHER edges anchored on the same node border (using the final
 * assigned offsets). The alignment snap only slides anchors on otherwise
 * unoccupied borders, so it can never collide with a neighbour.
 */
function borderPeerCount(
  selfId: string,
  nodeId: string,
  side: Side4,
  edges: EdgeRef[],
  sidesFor: (e: EdgeRef) => Sides,
  assignments: Map<string, { source: number; target: number }>,
): number {
  let count = 0
  for (const e of edges) {
    if (e.id === selfId) continue
    if (!assignments.has(e.id)) continue
    const s = sidesFor(e)
    if ((e.source === nodeId && s.source === side) || (e.target === nodeId && s.target === side)) count++
  }
  return count
}

/**
 * Final anchor offsets for every edge.
 *
 * Base layer: the border ladder (`attachmentOffset`) spreads edges sharing a
 * node border.
 *
 * Pair layer: the two edges of a bidirectional pair attach the SAME two
 * borders, but the two ladders are computed independently and can hand the
 * pair different absolute positions on each side — the pair then renders as
 * jittery Z-jogs instead of clean parallel lines (and when the two borders
 * order the pair differently, as crossing lines). Both partners are therefore
 * PINNED to one canonical order — the leader's (smaller id) source border
 * positions — transferred unchanged to the leader's target border so each
 * edge runs straight (equal offset at both ends). Other edges anchored on
 * the affected border are nudged upward in lane-width steps until clear.
 *
 * Everything here is a pure function of the board, and every edge's route
 * computes the same assignments — no coordination needed.
 */
function computeAnchorAssignments(
  edges: EdgeRef[],
  boxById: Map<string, Box>,
  sidesFor: (e: EdgeRef) => Sides,
): Map<string, { source: number; target: number }> {
  const result = new Map<string, { source: number; target: number }>()
  for (const e of edges) {
    const s = sidesFor(e)
    result.set(e.id, {
      source: attachmentOffset(e.id, e.source, s.source, edges, boxById, sidesFor),
      target: attachmentOffset(e.id, e.target, s.target, edges, boxById, sidesFor),
    })
  }

  // Push `v` to the nearest free slot: positions a lane-width clear of every
  // pinned value, searched outwards from `v` (nearest first; ties prefer the
  // upper slot). Candidate slots sit a lane width beyond the pinned values so
  // the search can cross lattice offsets between different borders.
  const nudge = (v: number, half: number, pinned: number[]): number => {
    const clear = (x: number) =>
      Math.abs(x) <= half + 0.01 && !pinned.some((p) => Math.abs(p - x) < LANE_SPACING - 0.01)
    if (clear(v)) return v
    const candidates = new Set<number>([v])
    for (const p of pinned) {
      candidates.add(p + LANE_SPACING)
      candidates.add(p - LANE_SPACING)
    }
    let best: number | null = null
    for (const c of candidates) {
      if (!clear(c)) continue
      const dist = Math.abs(c - v)
      if (best === null || dist < Math.abs(best - v) || (dist === Math.abs(best - v) && c > best)) best = c
    }
    return best ?? clamp(v, -half, half)
  }

  const paired = new Set<string>()
  const ordered = [...edges].sort((a, b) => (a.id < b.id ? -1 : 1))
  for (const e of ordered) {
    if (paired.has(e.id) || e.source === e.target) continue
    const reverse = edges.find((r) => r.id !== e.id && r.source === e.target && r.target === e.source)
    if (!reverse || paired.has(reverse.id) || reverse.source === reverse.target) continue
    const s = sidesFor(e)
    const rs = sidesFor(reverse)
    // Pair only mirrored attachments (the two edges attach the same two
    // borders with swapped roles).
    if (rs.source !== s.target || rs.target !== s.source) continue
    paired.add(e.id)
    paired.add(reverse.id)

    const leader = e.id < reverse.id ? e : reverse
    const partner = leader.id === e.id ? reverse : e
    const leaderAssign = result.get(leader.id)!
    const partnerAssign = result.get(partner.id)!
    const ls = sidesFor(leader)
    const ld0 = OUTWARD[ls.source]
    const ld3 = OUTWARD[ls.target]
    // Head-on mirror (right↔left) → straighten both edges into parallel runs.
    // Perpendicular mirror (right→bottom + bottom→right, a pair of nested
    // L-shapes) can NEVER run straight without crossing: instead both edges
    // share the same ordered offset pair (small at the leader's source
    // border, large at its target border), which nests the two Ls cleanly.
    const perpendicularMirror = ld0.x !== 0 !== (ld3.x !== 0)
    // For perpendicular mirrors the crossing-free nesting depends on the
    // road's travel direction: down-right (or up-left) roads need the swapped
    // offsets, the other diagonals nest when both edges run straight.
    const lb = boxById.get(leader.source)
    const lt = boxById.get(leader.target)
    const roadSigma =
      (Math.sign((lt?.rect.x ?? 0) + (lt?.rect.width ?? 0) / 2 - ((lb?.rect.x ?? 0) + (lb?.rect.width ?? 0) / 2)) || 1) *
      (Math.sign((lt?.rect.y ?? 0) + (lt?.rect.height ?? 0) / 2 - ((lb?.rect.y ?? 0) + (lb?.rect.height ?? 0) / 2)) || 1)

    // Canonical border = the leader's source border (the leader attaches it
    // as source, the partner as target). Keep the two positions a lane apart.
    let leaderPos = leaderAssign.source
    let partnerPos = partnerAssign.target
    if (Math.abs(leaderPos - partnerPos) < LANE_SPACING) {
      const lo = Math.min(leaderPos, partnerPos)
      const hi = Math.max(lo + LANE_SPACING, Math.max(leaderPos, partnerPos))
      if (leaderPos <= partnerPos) {
        leaderPos = lo
        partnerPos = hi
      } else {
        leaderPos = hi
        partnerPos = lo
      }
    }
    leaderAssign.source = leaderPos
    partnerAssign.target = partnerPos

    // Clamp helper for the leader's target border (both edges anchor there).
    const tgtSide = ls.target
    const tgtBox = boxById.get(leader.target)
    const half = tgtBox ? halfFor(tgtBox.rect, tgtSide) : Infinity
    const savedLeaderTgt = leaderAssign.target
    const savedPartnerSrc = partnerAssign.source

    if (perpendicularMirror && roadSigma > 0) {
      // Both edges: small offset at the leader's source border, large at the
      // leader's target border — the nested-L configuration for this diagonal.
      leaderAssign.target = clamp(partnerPos, -half, half)
      partnerAssign.source = clamp(leaderPos, -half, half)
    } else {
      // Straighten: transfer each edge's canonical position to the leader's
      // target border (leader as target, partner as source).
      leaderAssign.target = clamp(leaderPos, -half, half)
      partnerAssign.source = clamp(partnerPos, -half, half)
    }
    if (Math.abs(leaderAssign.target - partnerAssign.source) < LANE_SPACING - 0.01) {
      // The target border is too small for the canonical pair (clamping
      // broke the separation). Fall back to the border's own compressed
      // ladder for everyone — the dip/lane layers handle the resulting jogs.
      leaderAssign.target = savedLeaderTgt
      partnerAssign.source = savedPartnerSrc
    }

    // Absolute coordinates of every assigned anchor on a border (excluding
    // one edge) — used to keep far-end moves collision-free.
    const anchorsOn = (nodeId: string, side: Side4, excludeId: string): number[] => {
      const vals: number[] = []
      for (const o of edges) {
        if (o.id === excludeId) continue
        const os = sidesFor(o)
        const oa = result.get(o.id)
        if (!oa) continue
        if (o.source === nodeId && os.source === side) vals.push(oa.source)
        if (o.target === nodeId && os.target === side) vals.push(oa.target)
      }
      return vals
    }

    // Nudge other edges anchored on the target border until they clear the
    // pinned pair (and each other). When a nudged edge's far end has room,
    // it is shifted by the same amount so the edge stays straight.
    const pinned = [leaderAssign.target, partnerAssign.source]
    for (const o of edges) {
      if (o.id === leader.id || o.id === partner.id) continue
      const os = sidesFor(o)
      const oa = result.get(o.id)
      if (!oa) continue
      for (const role of ["source", "target"] as const) {
        const node = role === "source" ? o.source : o.target
        const side = role === "source" ? os.source : os.target
        if (node !== leader.target || side !== tgtSide) continue
        const before = oa[role]
        const nv = nudge(before, half, pinned)
        pinned.push(nv)
        oa[role] = nv
        const shift = nv - before
        if (Math.abs(shift) > 0.01) {
          const otherRole = role === "source" ? "target" : "source"
          const otherNode = role === "source" ? o.target : o.source
          const otherSide = role === "source" ? os.target : os.source
          const otherBox = boxById.get(otherNode)
          if (otherBox) {
            const oh = halfFor(otherBox.rect, otherSide)
            const candidate = clamp(oa[otherRole] + shift, -oh, oh)
            if (
              Math.abs(candidate - (oa[otherRole] + shift)) < 0.01 &&
              anchorsOn(otherNode, otherSide, o.id).every(
                (p) => Math.abs(p - candidate) >= LANE_SPACING - 0.01,
              )
            ) {
              oa[otherRole] = candidate
            }
          }
        }
      }
    }
  }
  return result
}

/**
 * Lane base for a head-on Z route: minus the exit anchor scaled by the road's
 * direction product (σ = dx·dy of the source→target centers). Ordering the
 * base by the exit anchor keeps edges sharing a corridor in exit order — the
 * crossing-free lane order for parallel runs (the lower-exiting edge takes
 * the more positive lane side).
 */
function headOnLaneBase(
  offs: { source: number; target: number },
  sourceBox: Box,
  targetBox: Box,
): number {
  const sigma =
    (Math.sign(targetBox.rect.x + targetBox.rect.width / 2 - (sourceBox.rect.x + sourceBox.rect.width / 2)) || 1) *
    (Math.sign(targetBox.rect.y + targetBox.rect.height / 2 - (sourceBox.rect.y + sourceBox.rect.height / 2)) || 1)
  return -sigma * offs.source
}

/**
 * Fallback lane split for bidirectional pairs whose straightened anchors got
 * clamped (the transferred offset did not fit the border): the two head-on
 * corridors still need lanes a full width apart. Which SIDE of the corridor
 * the first-anchored edge takes depends on the road's travel direction: the
 * pair forms a racetrack, and the wrong side makes the two Z-routes cross.
 * With the leader's travel direction (dx, dy) the first-anchored edge takes
 * the + lane side when dx·dy > 0 and the − side when dx·dy < 0 — captured by
 * the product of the two direction signs. Both partners evaluate the same
 * σ from the same boxes, so they always agree.
 */
function pairLaneDelta(
  self: EdgeRef,
  sides: Sides,
  selfOffs: { source: number; target: number },
  edges: EdgeRef[],
  boxById: Map<string, Box>,
  offsFor: (e: EdgeRef) => { source: number; target: number },
  sidesFor: (e: EdgeRef) => Sides,
): number {
  const reverse = edges.find((e) => e.id !== self.id && e.source === self.target && e.target === self.source)
  if (!reverse) return 0
  const d0 = OUTWARD[sides.source]
  const d3 = OUTWARD[sides.target]
  // Only meaningful for head-on combos (opposite stub directions).
  if (d0.x !== -d3.x || d0.y !== -d3.y) return 0
  const rs = sidesFor(reverse)
  if (rs.source !== sides.target || rs.target !== sides.source) return 0
  const rOffs = offsFor(reverse)
  const selfBox = boxById.get(self.source)
  const revBox = boxById.get(reverse.source)
  if (!selfBox || !revBox) return 0
  const leaderIsSelf = self.id < reverse.id
  const leader = leaderIsSelf ? self : reverse
  const lb = boxById.get(leader.source)
  const lt = boxById.get(leader.target)
  if (!lb || !lt) return 0
  const sigma =
    (Math.sign(lt.rect.x + lt.rect.width / 2 - (lb.rect.x + lb.rect.width / 2)) || 1) *
    (Math.sign(lt.rect.y + lt.rect.height / 2 - (lb.rect.y + lb.rect.height / 2)) || 1)
  // "selfFirst" = my anchor sits before my partner's along the border axis at
  // the canonical border (the leader's source border) — evaluated identically
  // by both partners.
  const aSelf = leaderIsSelf ? selfOffs.source : selfOffs.target
  const aRev = leaderIsSelf ? rOffs.target : rOffs.source
  const selfFirst = aSelf < aRev || (aSelf === aRev && self.id < reverse.id)
  // Base difference must mirror what the route adds (headOnLaneBase) so the
  // separation algebra cancels exactly.
  const baseSelf = headOnLaneBase(selfOffs, selfBox, boxById.get(self.target)!)
  const baseRev = headOnLaneBase(rOffs, revBox, boxById.get(reverse.target)!)
  const d = baseSelf - baseRev
  return selfFirst ? (sigma * LANE_SPACING - d) / 2 : -(sigma * LANE_SPACING + d) / 2
}

// ---------------------------------------------------------------------------
// Corridor lanes: keep head-on Z routes of the same region a width apart
// ---------------------------------------------------------------------------

interface LaneNode {
  id: string
  /** Absolute coordinate of the corridor lane (x on horizontal runs, y on vertical). */
  lane: number
  /** Span of the lane's perpendicular segment (the Z's cross-country run). */
  lo: number
  hi: number
}

/**
 * Provisional corridor lane for every routed edge with a free mid segment
 * (head-on Z bends and same-direction swings), derived from the final anchor
 * assignments. Everything here is a pure function of the board, so every edge
 * evaluates identical values and the sweep below stays consistent across
 * independently routed edges.
 */
function collectLaneNodes(
  edges: EdgeRef[],
  boxById: Map<string, Box>,
  offsFor: (e: EdgeRef) => { source: number; target: number },
  sidesFor: (e: EdgeRef) => Sides,
): LaneNode[] {
  const nodes: LaneNode[] = []
  for (const e of edges) {
    const s = sidesFor(e)
    const d0 = OUTWARD[s.source]
    const d3 = OUTWARD[s.target]
    const headOn = d0.x === -d3.x && d0.y === -d3.y
    const sameDir = d0.x === d3.x && d0.y === d3.y
    if (!headOn && !sameDir) continue // perpendicular elbows have no free mid segment
    const a = boxById.get(e.source)
    const b = boxById.get(e.target)
    if (!a || !b) continue
    const offs = offsFor(e)
    const a0 = anchorPoint(a.rect, s.source, offs.source)
    const a3 = anchorPoint(b.rect, s.target, offs.target)
    const s0 = { x: a0.x + d0.x * STUB, y: a0.y + d0.y * STUB }
    const s1 = { x: a3.x + d3.x * STUB, y: a3.y + d3.y * STUB }
    const horizontal = d0.x !== 0
    const dip = horizontal ? s1.y - s0.y : s1.x - s0.x
    if (Math.abs(dip) < 0.5) continue // straight run — owns no lane segment
    // Head-on routes bend at the corridor mid; same-direction routes swing
    // just beyond the farther node. Either way the segment needs a lane.
    const laneCoord = headOn
      ? horizontal
        ? (s0.x + s1.x) / 2
        : (s0.y + s1.y) / 2
      : horizontal
        ? d0.x > 0
          ? Math.max(s0.x, s1.x) + STUB
          : Math.min(s0.x, s1.x) - STUB
        : d0.y > 0
          ? Math.max(s0.y, s1.y) + STUB
          : Math.min(s0.y, s1.y) - STUB
    const base = headOn
      ? headOnLaneBase(offs, a, b)
      : (offs.source - offs.target) / 2
    const delta = pairLaneDelta(e, s, offs, edges, boxById, offsFor, sidesFor)
    nodes.push({
      id: e.id,
      lane: laneCoord + base + delta,
      lo: horizontal ? Math.min(s0.y, s1.y) : Math.min(s0.x, s1.x),
      hi: horizontal ? Math.max(s0.y, s1.y) : Math.max(s0.x, s1.x),
    })
  }
  return nodes
}

/** How far a swept lane may travel from its provisional position before the
    sweep gives up (caps cascades in very dense regions). */
const LANE_PUSH_CAP = LANE_SPACING * 4

/**
 * Spreads the corridor lanes of edges traversing the same region at least one
 * lane width apart. Each edge resolves the same connected component of
 * mutually-close, span-overlapping lanes and sweeps it in lane order — the
 * first lane keeps its place, every later one slides to a width past its
 * predecessor — so independently routed edges land on consistent lanes.
 */
function deconflictCorridorLane(selfId: string, nodes: LaneNode[]): number {
  const self = nodes.find((n) => n.id === selfId)
  if (!self) return 0
  const component: LaneNode[] = [self]
  const seen = new Set<string>([self.id])
  for (let i = 0; i < component.length; i++) {
    for (const n of nodes) {
      if (seen.has(n.id)) continue
      const c = component[i]
      if (Math.abs(c.lane - n.lane) < LANE_SPACING - 0.01 && c.lo <= n.hi && n.lo <= c.hi) {
        component.push(n)
        seen.add(n.id)
      }
    }
  }
  if (component.length === 1) return 0
  component.sort((a, b) => a.lane - b.lane || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  let prev = -Infinity
  let assignedSelf = self.lane
  for (const n of component) {
    let assigned = n.lane
    if (assigned < prev + LANE_SPACING) assigned = prev + LANE_SPACING
    if (assigned - n.lane > LANE_PUSH_CAP) assigned = n.lane
    if (n.id === selfId) assignedSelf = assigned
    prev = assigned
  }
  return assignedSelf - self.lane
}

// ---------------------------------------------------------------------------
// Grid A* fallback for fully blocked corridors
// ---------------------------------------------------------------------------

/**
 * Orthogonal A* on a coarse grid. Obstacles must already be inflated. Returns
 * interior waypoints from `s0` to `s1` (excluding the endpoints), or null.
 *
 * When `exitDir` is given the first step is forced along that direction (the
 * source stub axis) and when `entryDir` is given the final step into the goal
 * must travel along it (the direction into the target stub) — without these
 * constraints the grid path used to hook/double-back right at the anchors.
 */
function astarRoute(s0: Pt, s1: Pt, obstacles: Rect[], exitDir?: Pt, entryDir?: Pt): Pt[] | null {
  if (exitDir && entryDir) {
    const constrained = astarSearch(s0, s1, obstacles, exitDir, entryDir)
    if (constrained) return constrained
  }
  return astarSearch(s0, s1, obstacles)
}

function astarSearch(s0: Pt, s1: Pt, obstacles: Rect[], exitDir?: Pt, entryDir?: Pt): Pt[] | null {
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

  // Grid line coordinates. The exact stub-axis coordinates of both endpoints
  // are inserted as grid lines, so the constrained exit/entry steps run along
  // the stub axes with zero jog (the previous uniform grid forced the anchor
  // alignment to shift points, which rendered as diagonal kinks).
  const xs: number[] = []
  for (let c = 0; c < cols; c++) xs.push(minX + c * cell)
  const ys: number[] = []
  for (let r = 0; r < rows; r++) ys.push(minY + r * cell)
  const ensureLine = (arr: number[], v: number) => {
    for (let i = 0; i < arr.length; i++) {
      if (Math.abs(arr[i] - v) <= 0.01) return
    }
    let best = 0
    for (let i = 1; i < arr.length; i++) {
      if (Math.abs(arr[i] - v) < Math.abs(arr[best] - v)) best = i
    }
    arr.splice(arr[best] < v ? best + 1 : best, 0, v)
  }
  ensureLine(xs, s0.x)
  ensureLine(xs, s1.x)
  ensureLine(ys, s0.y)
  ensureLine(ys, s1.y)
  // An inserted endpoint line can sit right next to the uniform line it
  // replaced — drop the near-duplicate (endpoint lines always win).
  const squeeze = (arr: number[], exact: number[]) => {
    const isExact = (v: number) => exact.some((k) => Math.abs(k - v) <= 0.01)
    const out: number[] = []
    for (const v of arr) {
      const prev = out[out.length - 1]
      if (prev !== undefined && v - prev < 2) {
        if (isExact(prev)) continue // keep the exact line, drop the near-dup
        if (isExact(v)) out.pop() // replace the uniform line with the exact one
        else continue // two near-duplicate uniform lines — keep the first
      }
      out.push(v)
    }
    return out
  }
  const sx = squeeze(xs, [s0.x, s1.x])
  const sy = squeeze(ys, [s0.y, s1.y])
  xs.length = 0
  xs.push(...sx)
  ys.length = 0
  ys.push(...sy)
  cols = xs.length
  rows = ys.length

  const size = cols * rows
  const blocked = new Uint8Array(size)
  const cellIdx = (c: number, r: number) => r * cols + c
  for (let r = 0; r < rows; r++) {
    const y = ys[r]
    const hh = (r + 1 < rows ? ys[r + 1] : ys[r] + cell) - y
    for (let c = 0; c < cols; c++) {
      const x = xs[c]
      const ww = (c + 1 < cols ? xs[c + 1] : xs[c] + cell) - x
      for (const o of obstacles) {
        if (x < o.x + o.width + 2 && x + ww > o.x - 2 && y < o.y + o.height + 2 && y + hh > o.y - 2) {
          blocked[cellIdx(c, r)] = 1
          break
        }
      }
    }
  }

  const nearestIndex = (arr: number[], v: number) => {
    let lo = 0
    let hi = arr.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (arr[mid] < v) lo = mid + 1
      else hi = mid
    }
    if (lo > 0 && Math.abs(arr[lo - 1] - v) < Math.abs(arr[lo] - v)) lo--
    return lo
  }
  const clearNear = (p: Pt) => {
    const c0 = nearestIndex(xs, p.x)
    const r0 = nearestIndex(ys, p.y)
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

  const startC = nearestIndex(xs, s0.x)
  const startR = nearestIndex(ys, s0.y)
  const goalC = nearestIndex(xs, s1.x)
  const goalR = nearestIndex(ys, s1.y)
  const startIdx = cellIdx(startC, startR)
  const goalIdx = cellIdx(goalC, goalR)

  // State = cell × direction (0:+x, 1:-x, 2:+y, 3:-y).
  const DIRS: Pt[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]
  // Direction the route must leave the source stub along, and the direction
  // it must travel when arriving at the target stub (-1 = unconstrained).
  const seedDir = exitDir ? DIRS.findIndex((d) => d.x === exitDir.x && d.y === exitDir.y) : -1
  const wantDir = entryDir ? DIRS.findIndex((d) => d.x === entryDir.x && d.y === entryDir.y) : -1
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
    if (seedDir >= 0 && d !== seedDir) continue
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
      // Only accept an arrival that continues straight into the target stub;
      // other approach angles would bend the last segment into a hook.
      if (wantDir >= 0 && dir !== wantDir) continue
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
    rev.push({ x: xs[c], y: ys[r] })
    cur = parent[cur]
  }
  rev.reverse()
  // With the endpoint-snapped grid the start cell is exactly (s0.x, s0.y), the
  // goal cell exactly (s1.x, s1.y), and the constrained first/last steps run
  // along the stub axes — no anchor alignment (and thus no jog) is needed.
  const pts = rev.slice(1, -1)
  return pruneBacktracks(simplifyPath(pts))
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
  /** Optional debug sink (used by scripts/check-routes.ts). */
  debug?: (info: Record<string, unknown>) => void
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
      // Container ancestors of the endpoints are never obstacles for their
      // edges (a child edge must cross the container border).
      const excluded = obstacleExclusionsFor(e.source, e.target, boxes, boxById)
      const othersInf = boxes
        .filter((bx) => !excluded.has(bx.id))
        .map((bx) => inflateRect(bx.rect, OBSTACLE_PAD))
      const ownShrunk = [shrinkRect(a.rect, 1), shrinkRect(b.rect, 1)]
      result = chooseSides(a.rect, b.rect, othersInf, ownShrunk, sidesMemory.get(e.id))
    }
    sidesCache.set(e.id, result)
    sidesMemory.set(e.id, result)
    return result
  }

  const self: EdgeRef = { id: edgeId, source: sourceId, target: targetId }
  // Drop memory entries for edges that no longer exist (amortised sweep).
  pruneSidesMemory(new Set(edges.map((e) => e.id)))
  const sides = sidesFor(self)

  // Coordinated anchor assignment (border ladder + bidirectional-pair
  // straightening). Every edge computes the identical map from the same board
  // state, so independently routed edges stay consistent.
  const assignments = computeAnchorAssignments(edges, boxById, sidesFor)
  const offsFor = (e: EdgeRef): { source: number; target: number } =>
    assignments.get(e.id) ?? { source: 0, target: 0 }

  // Spread on shared borders (already pair-coordinated).
  const baseOffs = offsFor(self)
  let srcOff = baseOffs.source
  let tgtOff = baseOffs.target

  // Dip alignment snap: a head-on route whose two stub ends are only a few
  // pixels apart renders as a pointless little jog (two same-height nodes
  // whose anchors were spread apart by border bundling, for example). When
  // the far border has no other bundled edge, slide that anchor to meet the
  // near one so the edge renders as a clean straight run. (Bidirectional
  // pairs are already straightened by the assignment; their borders always
  // have an occupant, so this is a no-op for them.)
  const d0 = OUTWARD[sides.source]
  const d3 = OUTWARD[sides.target]
  const headOn = d0.x === -d3.x && d0.y === -d3.y
  if (headOn) {
    const horizontal = d0.x !== 0
    const a0 = anchorPoint(srcBox.rect, sides.source, srcOff)
    const a3 = anchorPoint(tgtBox.rect, sides.target, tgtOff)
    const stub0 = { x: a0.x + d0.x * STUB, y: a0.y + d0.y * STUB }
    const stub1 = { x: a3.x + d3.x * STUB, y: a3.y + d3.y * STUB }
    const dip = horizontal ? stub1.y - stub0.y : stub1.x - stub0.x
    if (Math.abs(dip) > 0.5 && Math.abs(dip) <= DIP_SNAP_MAX) {
      const srcFree = borderPeerCount(edgeId, sourceId, sides.source, edges, sidesFor, assignments) === 0
      const tgtFree = borderPeerCount(edgeId, targetId, sides.target, edges, sidesFor, assignments) === 0
      const slide = (nodeId: string, side: Side4, off: number, delta: number): number => {
        const box = boxById.get(nodeId)
        if (!box) return off
        return clamp(off + delta, -halfFor(box.rect, side), halfFor(box.rect, side))
      }
      // The free side absorbs the dip; with both free the target aligns to
      // the source (deterministic either way).
      if (tgtFree) tgtOff = slide(targetId, sides.target, tgtOff, -dip)
      else if (srcFree) srcOff = slide(sourceId, sides.source, srcOff, dip)
    }
  }

  // Corridor lane: the bidirectional-pair split (full width apart, side set
  // by the road's travel direction so the pair nests without crossings) plus
  // a deterministic sweep that keeps the free segments of ALL routed edges
  // passing through the same region a width apart — head-on Zs and same-side
  // swings alike.
  const rawBase = headOn
    ? headOnLaneBase(baseOffs, srcBox, tgtBox)
    : (baseOffs.source - baseOffs.target) / 2
  const pairDelta = pairLaneDelta(self, sides, baseOffs, edges, boxById, offsFor, sidesFor)
  let midShift = rawBase + pairDelta
  const sameDir = d0.x === d3.x && d0.y === d3.y
  const dbg: Record<string, unknown> = {
    sides,
    offs: { ...baseOffs },
    rawBase,
    pairDelta,
  }
  if (headOn || sameDir) {
    const laneNodes = collectLaneNodes(edges, boxById, offsFor, sidesFor)
    const laneAdjust = deconflictCorridorLane(edgeId, laneNodes)
    midShift += laneAdjust
    dbg.laneNodes = laneNodes
    dbg.laneAdjust = laneAdjust
  }
  if (headOn) {
    // Keep the lane inside the corridor so the Z never hooks backwards.
    const horizontal = d0.x !== 0
    const a0 = anchorPoint(srcBox.rect, sides.source, baseOffs.source)
    const a3 = anchorPoint(tgtBox.rect, sides.target, baseOffs.target)
    const stub0 = { x: a0.x + d0.x * STUB, y: a0.y + d0.y * STUB }
    const stub1 = { x: a3.x + d3.x * STUB, y: a3.y + d3.y * STUB }
    const mid = horizontal ? (stub0.x + stub1.x) / 2 : (stub0.y + stub1.y) / 2
    const axis0 = horizontal ? stub0.x : stub0.y
    const axis1 = horizontal ? stub1.x : stub1.y
    const lo = Math.min(axis0, axis1)
    const hi = Math.max(axis0, axis1)
    if (hi - lo > 8) {
      midShift = clamp(mid + midShift, lo + 2, hi - 2) - mid
    }
  }
  dbg.midShift = midShift

  // Same containment rule for this edge's own obstacle set.
  const selfExcluded = obstacleExclusionsFor(sourceId, targetId, boxes, boxById)
  const othersInf = boxes
    .filter((bx) => !selfExcluded.has(bx.id))
    .map((bx) => inflateRect(bx.rect, OBSTACLE_PAD))
  const ownShrunk = [shrinkRect(srcBox.rect, 1), shrinkRect(tgtBox.rect, 1)]

  const isClean = (pts: Pt[]) => !polylineHits(pts, othersInf) && !polylineHits(pts.slice(1, -1), ownShrunk)

  const buildSimple = (ss: Side4, ts: Side4, shift: number): Pt[] => {
    const a0 = anchorPoint(srcBox.rect, ss, ss === sides.source ? srcOff : 0)
    const a3 = anchorPoint(tgtBox.rect, ts, ts === sides.target ? tgtOff : 0)
    return pruneBacktracks(simpleRoute(a0, OUTWARD[ss], a3, OUTWARD[ts], STUB, shift))
  }

  // 1) Fast path: first clean combo already avoids everything. The chosen
  //    (hysteresis-stable) combo is tried first so unrelated movement cannot
  //    flip the shape to a marginally shorter alternative. If the full lane
  //    shift pushes the corridor into an obstacle, degrade it gracefully
  //    (half, then zero) — never flip its sign, which would re-introduce
  //    pair interweaving.
  const ranked = rankCombos(srcBox.rect, tgtBox.rect, othersInf, ownShrunk)
  const chosen = ranked.find((c) => c.source === sides.source && c.target === sides.target)
  const ordered = chosen ? [chosen, ...ranked.filter((c) => c !== chosen)] : ranked
  for (const combo of ordered) {
    if (!combo.clean) continue
    for (const shift of [midShift, midShift / 2, 0]) {
      const pts = buildSimple(combo.source, combo.target, shift)
      if (isClean(pts)) {
        input.debug?.({ ...dbg, branch: `fast:${shift}` })
        return { points: pts, sourceSide: combo.source, targetSide: combo.target }
      }
    }
  }

  // 2) Nothing clean: A* detours for the most promising combos, constrained
  //    to leave/enter along the stub axes so the detour has no anchor hooks.
  //    The chosen combo is evaluated first to keep the shape stable.
  const candidates: RankedCombo[] = []
  if (chosen) candidates.push(chosen)
  for (const combo of ranked) {
    if (candidates.length >= ASTAR_CANDIDATES) break
    if (!candidates.includes(combo)) candidates.push(combo)
  }
  let best: { pts: Pt[]; cost: number; ss: Side4; ts: Side4 } | null = null
  for (const combo of candidates) {
    const a0 = anchorPoint(srcBox.rect, combo.source, combo.source === sides.source ? srcOff : 0)
    const a3 = anchorPoint(tgtBox.rect, combo.target, combo.target === sides.target ? tgtOff : 0)
    const d0 = OUTWARD[combo.source]
    const d3 = OUTWARD[combo.target]
    const s0 = { x: a0.x + d0.x * STUB, y: a0.y + d0.y * STUB }
    const s1 = { x: a3.x + d3.x * STUB, y: a3.y + d3.y * STUB }
    const astarObstacles = [...othersInf, ...ownShrunk]
    const mid = astarRoute(s0, s1, astarObstacles, d0, { x: -d3.x, y: -d3.y })
    if (!mid) continue
    const pts = pruneBacktracks(simplifyPath([a0, s0, ...mid, s1, a3]))
    const cost = polyLength(pts) + countTurns(pts) * 8
    if (!best || cost < best.cost) best = { pts, cost, ss: combo.source, ts: combo.target }
  }
  if (best) {
    input.debug?.({ ...dbg, branch: "astar" })
    return { points: best.pts, sourceSide: best.ss, targetSide: best.ts }
  }

  // 3) Last resort: the chosen combo's naive route even if it grazes
  //    something (keeps the previous shape instead of jumping elsewhere).
  const fallback = chosen ?? ranked[0]
  input.debug?.({ ...dbg, branch: "fallback" })
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
