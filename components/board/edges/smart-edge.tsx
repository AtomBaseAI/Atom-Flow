"use client"

import { useMemo } from "react"
import { getSmoothStepPath, Position, useStore, type EdgeProps } from "@xyflow/react"
import {
  routeEdge,
  roundedPath,
  type Box,
  type EdgeRef,
  type Pt,
  type RouteResult,
} from "./edge-routing"

function fallbackPath(props: EdgeProps): string {
  const [path] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition ?? Position.Right,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition ?? Position.Left,
    borderRadius: 8,
  })
  return path
}

/**
 * Intelligent orthogonal edge.
 *
 * The routing brain lives in `./edge-routing` (pure, unit-tested); this
 * component only gathers the board state (every node box + every edge) and
 * renders the resulting polyline. Compared with the previous geometry-only
 * connector it additionally:
 *   - attaches to whichever box sides keep the route clear of obstacles
 *     (e.g. over the top of a node that blocks the direct corridor),
 *   - keeps parallel / bidirectional edges on distinct lanes with a constant
 *     gap along the whole run, not just at the endpoints,
 *   - detours around unrelated nodes via a coarse-grid A* when the direct
 *     orthogonal route is blocked.
 */
export default function SmartEdge(props: EdgeProps) {
  const { id, source, target, style } = props

  // Subscribe to the user-facing `nodes` array: React Flow replaces its
  // reference on every position/dimension change (drag, resize, add, remove).
  // NOTE: `nodeLookup` is mutated in place by the store, so its reference
  // never changes and cannot be used as a reactivity trigger here.
  const nodes = useStore((state) => state.nodes)
  const allEdges = useStore((state) => state.edges)

  const route: RouteResult | null = useMemo(() => {
    if (!source || !target) return null
    const boxes: Box[] = []
    for (const node of nodes) {
      const width = node.measured?.width ?? (node as any).width ?? Number((node.style as any)?.width)
      const height = node.measured?.height ?? (node as any).height ?? Number((node.style as any)?.height)
      boxes.push({
        id: node.id,
        rect: {
          x: Number(node.position?.x) || 0,
          y: Number(node.position?.y) || 0,
          width: Number.isFinite(width) && width > 0 ? width : 140,
          height: Number.isFinite(height) && height > 0 ? height : 56,
        },
      })
    }
    const refs: EdgeRef[] = allEdges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
    return routeEdge({ edgeId: id, sourceId: source, targetId: target, boxes, edges: refs })
  }, [nodes, allEdges, id, source, target])

  const points: Pt[] | null = route?.points ?? null
  const path = points && points.length >= 2 ? roundedPath(points) : fallbackPath(props)

  // Per-edge arrow so multiple edges never share/clash one marker definition.
  // Default (no explicit stroke) follows the theme via the --af-edge token;
  // a user-picked stroke color is a literal value and stays across themes.
  const strokeColor = style?.stroke ?? "var(--af-edge)"
  const arrowId = `smart-edge-arrow-${id}`

  return (
    <g>
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 12 12"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          {/* var() is only valid in style properties, never in presentation attributes */}
          <path d="M0,0 L12,6 L0,12 L4,6 Z" style={{ fill: strokeColor }} />
        </marker>
      </defs>

      {/* Wide invisible hit-area: a 1px connector is nearly impossible to
          click. A transparent stroke still receives pointer events, so clicks
          within ~20px of the line land on the edge. */}
      <path
        className="react-flow__edge-interaction"
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="stroke"
      />

      <path
        id={id}
        d={path}
        fill="none"
        strokeWidth={style?.strokeWidth ?? 1}
        style={{ ...style, stroke: strokeColor }}
        markerStart={undefined}
        markerEnd={`url(#${arrowId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="stroke"
        className="smart-edge-line"
      />
    </g>
  )
}
