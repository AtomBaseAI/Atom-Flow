"use client"

import { type EdgeProps, getSmoothStepPath, Position, useReactFlow } from "@xyflow/react"

function pickSides(dx: number, dy: number) {
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  if (horizontal) {
    return {
      source: dx > 0 ? Position.Right : Position.Left,
      target: dx > 0 ? Position.Left : Position.Right,
    }
  }
  return {
    source: dy > 0 ? Position.Bottom : Position.Top,
    target: dy > 0 ? Position.Top : Position.Bottom,
  }
}

export default function SmartEdge(props: EdgeProps) {
  const {
    id,
    source,
    target,
    style,
    markerEnd,
    // fallbacks provided by React Flow during interactions
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  } = props

  const rf = useReactFlow()
  const s = source ? rf.getNode(source) : undefined
  const t = target ? rf.getNode(target) : undefined

  // Compute centers if nodes exist
  const sw = s?.measured?.width ?? s?.width ?? 0
  const sh = s?.measured?.height ?? s?.height ?? 0
  const tw = t?.measured?.width ?? t?.width ?? 0
  const th = t?.measured?.height ?? t?.height ?? 0

  const sxNode = s ? (s.positionAbsolute?.x ?? s.position.x) + sw / 2 : undefined
  const syNode = s ? (s.positionAbsolute?.y ?? s.position.y) + sh / 2 : undefined
  const txNode = t ? (t.positionAbsolute?.x ?? t.position.x) + tw / 2 : undefined
  const tyNode = t ? (t.positionAbsolute?.y ?? t.position.y) + th / 2 : undefined

  // Use node centers when available; otherwise fall back to provided edge props.
  const sx = sxNode ?? sourceX
  const sy = syNode ?? sourceY
  const tx = txNode ?? targetX
  const ty = tyNode ?? targetY

  // If we still don't have coordinates, safely bail to avoid runtime errors.
  if (sx == null || sy == null || tx == null || ty == null) {
    return null
  }

  // Choose sides: use geometry-based pick when we have both centers,
  // otherwise respect provided positions with sensible defaults.
  const sides =
    sxNode != null && syNode != null && txNode != null && tyNode != null
      ? pickSides(tx - sx, ty - sy)
      : {
          source: sourcePosition ?? Position.Right,
          target: targetPosition ?? Position.Left,
        }

  const gap = 10 // distance outside the node box where the path should end (arrowhead will be visible)

  function anchorFor(side: Position, cx: number, cy: number, w: number, h: number, g: number): [number, number] {
    switch (side) {
      case Position.Left:
        return [cx - w / 2 - g, cy]
      case Position.Right:
        return [cx + w / 2 + g, cy]
      case Position.Top:
        return [cx, cy - h / 2 - g]
      case Position.Bottom:
        return [cx, cy + h / 2 + g]
      default:
        return [cx, cy]
    }
  }

  // Compute anchor points; if node size/center is missing, fall back to provided coords
  const [ax, ay] =
    s && sxNode != null && syNode != null ? anchorFor(sides.source, sxNode, syNode, sw, sh, gap) : [sx, sy]
  const [bx, by] =
    t && txNode != null && tyNode != null ? anchorFor(sides.target, txNode, tyNode, tw, th, gap) : [tx, ty]

  // Start is always the SOURCE anchor; End is always the TARGET anchor.
  const startX = ax
  const startY = ay
  const endX = bx
  const endY = by
  const srcSide = sides.source
  const tgtSide = sides.target

  // Build the smooth step path using the corrected endpoints (source -> target).
  const [path] = getSmoothStepPath({
    sourceX: startX,
    sourceY: startY,
    sourcePosition: srcSide,
    sourceWidth: 0,
    sourceHeight: 0,
    targetX: endX,
    targetY: endY,
    targetPosition: tgtSide,
    targetWidth: 0,
    targetHeight: 0,
    borderRadius: 8,
    centerX: (startX + endX) / 2,
    centerY: (startY + endY) / 2,
  })

  // We ignore any incoming markerEnd and use a per-edge marker so multiple edges don't clash.
  const strokeColor = style?.stroke ?? "#a3a3a3"
  const strokeWidth = style?.strokeWidth ?? 1
  const arrowId = `smart-edge-arrow-${id}`

  return (
    <g>
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 12 12"
          markerWidth="8" // smaller arrowhead
          markerHeight="8" // smaller arrowhead
          refX="7" // adjust reference to match smaller size
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L12,6 L0,12 L4,6 Z" fill={strokeColor} />
        </marker>
      </defs>

      <path
        id={id}
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        style={style}
        markerStart={undefined}
        markerEnd={`url(#${arrowId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="stroke"
      />
    </g>
  )
}
