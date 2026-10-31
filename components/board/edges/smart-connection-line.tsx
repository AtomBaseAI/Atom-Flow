"use client"

import { getSmoothStepPath, Position, type ConnectionLineComponentProps } from "@xyflow/react"

/**
 * In-progress connection preview that matches the board's `SmartEdge` rendering.
 *
 * React Flow's default preview is a bezier curve anchored to the grabbed
 * handle's side, with the far end pinned to the *opposite* side. Whenever the
 * pointer travels in a direction that contradicts the handle orientation
 * (e.g. dragging from a right-side handle toward something below-left), the
 * two bezier control points cross and the line self-intersects into a loop.
 *
 * This component fixes the glitch by:
 *  1. starting exactly at the grabbed handle (no jump at drag start),
 *  2. leaving the node perpendicular to the grabbed edge (`fromPosition`),
 *  3. approaching the pointer / snapped target handle from the direction of
 *     travel (geometric side picking),
 * and drawing the same rounded "smooth step" path that `SmartEdge` renders,
 * so the preview never loops and closely matches the final edge.
 */

/** Same geometric side-picking used by SmartEdge. */
function pickTargetSide(dx: number, dy: number): Position {
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  if (horizontal) {
    return dx > 0 ? Position.Left : Position.Right
  }
  return dy > 0 ? Position.Top : Position.Bottom
}

/** Offset a point `gap` px outward from a boundary along the given side. */
function anchorFor(side: Position, x: number, y: number, gap: number): [number, number] {
  switch (side) {
    case Position.Left:
      return [x - gap, y]
    case Position.Right:
      return [x + gap, y]
    case Position.Top:
      return [x, y - gap]
    case Position.Bottom:
      return [x, y + gap]
    default:
      return [x, y]
  }
}

export default function SmartConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toHandle,
  connectionStatus,
}: ConnectionLineComponentProps) {
  // Direction of travel from the grabbed handle.
  const dx = toX - fromX
  const dy = toY - fromY
  const targetSide = pickTargetSide(dx, dy)

  // While snapped to a handle, park the arrow tip `gap` px outside the target
  // boundary along the approach side — the exact spot where the final
  // SmartEdge arrow will land. While free-dragging, tip follows the cursor.
  const gap = 10
  const [endX, endY] = toHandle ? anchorFor(targetSide, toX, toY, gap) : [toX, toY]

  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition ?? Position.Right,
    targetX: endX,
    targetY: endY,
    targetPosition: targetSide,
    borderRadius: 8,
  })

  const isValid = connectionStatus !== "invalid"
  const stroke = isValid ? "#2dd4bf" : "#71717a"

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={isValid ? undefined : "4 4"}
        opacity={isValid ? 0.95 : 0.6}
      />
      {/* Landing dot: marks exactly where the connection will attach. */}
      <circle cx={endX} cy={endY} r={2.5} fill={stroke} opacity={isValid ? 1 : 0.6} />
    </g>
  )
}
