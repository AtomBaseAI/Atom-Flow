"use client"

import type React from "react"

import { useCallback, useEffect, useRef, useState } from "react"
import { Handle, NodeResizer, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { cn } from "@/lib/utils"

export type ShapeKind = "rect" | "ellipse" | "triangle" | "diamond" | "hexagon"

export type ShapeNodeData = {
  shape?: ShapeKind
  fill?: string
  fontSize?: number
  fontColor?: string
  fontWeight?: number
  align?: "left" | "center" | "right"
  label?: string
  borderColor?: string
  borderStyle?: "solid" | "dashed"
  borderWidth?: number
}

export default function ShapeNode(props: NodeProps<ShapeNodeData>) {
  const { id, selected, data } = props
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { setNodes } = useReactFlow()
  const [tempLabel, setTempLabel] = useState<string>(data?.label ?? "")

  const {
    shape = "rect",
    fill = "#000000",
    fontSize = 8,
    fontColor = "#e5e7eb",
    fontWeight = 400,
    align = "center",
    label = "",
    borderColor = "#a3a3a3",
    borderStyle = "solid",
    borderWidth = 1, // default to 1px border
  } = data || {}

  const onDoubleClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation()
      e?.preventDefault()
      setTempLabel(label ?? "")
      setEditing(true)
    },
    [label],
  )

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [editing])

  const commitLabel = useCallback(() => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...(n.data as any), label: tempLabel } } : n)))
    setEditing(false)
  }, [id, setNodes, tempLabel])

  const cancelEdit = useCallback(() => {
    setTempLabel(label ?? "")
    setEditing(false)
  }, [label])

  const contentAlign =
    align === "left"
      ? "justify-start text-left"
      : align === "right"
        ? "justify-end text-right"
        : "justify-center text-center"

  const shapeClip: Record<ShapeKind, string> = {
    rect: "rounded-[2px]", // keep rectangle radius at 2px
    ellipse: "rounded-full",
    triangle: "[clip-path:polygon(50%_0%,0%_100%,100%_100%)]",
    diamond: "[clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]",
    hexagon: "[clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]",
  }

  const polygonPoints: Record<Exclude<ShapeKind, "rect" | "ellipse">, string> = {
    triangle: "50,0 100,100 0,100",
    diamond: "50,0 100,50 50,100 0,50",
    hexagon: "25,0 75,0 100,50 75,100 25,100 0,50",
  }

  return (
    <div className="relative group h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && !editing}
        minWidth={48}
        minHeight={28}
        lineStyle={{ stroke: "#2dd4bf", strokeWidth: 1 }}
        handleStyle={{ width: 8, height: 8, background: "#2dd4bf", borderRadius: 9999 }}
      />

      <div
        className={cn("relative h-full w-full", shapeClip[shape])}
        style={
          {
            background: fill,
            boxSizing: "border-box",
            borderColor: selected ? "#14b8a6" : borderColor,
            borderStyle: shape === "rect" || shape === "ellipse" ? borderStyle : "none",
            borderWidth: shape === "rect" || shape === "ellipse" ? borderWidth : 0,
            borderRadius: shape === "rect" ? 2 : undefined, // 2px for rectangles
          } as React.CSSProperties
        }
        onDoubleClick={onDoubleClick}
        onPointerDown={(e) => {
          if (editing) e.stopPropagation()
        }}
      >
        {shape !== "rect" && shape !== "ellipse" ? (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon
              points={polygonPoints[shape as Exclude<ShapeKind, "rect" | "ellipse">]}
              fill="transparent"
              stroke={selected ? "#14b8a6" : borderColor}
              strokeWidth={borderWidth || 1}
              strokeDasharray={borderStyle === "dashed" ? "6 6" : undefined}
            />
          </svg>
        ) : null}

        {(["Top", "Right", "Bottom", "Left"] as const).map((p) => (
          <Handle
            key={`s-${p}`}
            type="source"
            id={`s-${p.toLowerCase()}`}
            position={Position[p]}
            className={cn(
              "h-2 w-2 rounded bg-neutral-200 transition-opacity",
              editing ? "opacity-0" : selected ? "opacity-100" : "opacity-0 group-hover:opacity-60",
            )}
          />
        ))}
        {(["Top", "Right", "Bottom", "Left"] as const).map((p) => (
          <Handle
            key={`t-${p}`}
            type="target"
            id={`t-${p.toLowerCase()}`}
            position={Position[p]}
            className={cn(
              "h-2 w-2 rounded bg-neutral-200 transition-opacity",
              editing ? "opacity-0" : selected ? "opacity-100" : "opacity-0 group-hover:opacity-60",
            )}
          />
        ))}

        <div className={cn("absolute inset-0 flex items-center px-1", contentAlign)}>
          {editing ? (
            <input
              ref={inputRef}
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onBlur={(e) => {
                e.stopPropagation()
                commitLabel()
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === "Enter") {
                  e.preventDefault()
                  commitLabel()
                } else if (e.key === "Escape") {
                  e.preventDefault()
                  cancelEdit()
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full bg-neutral-900/70 outline-none"
              style={{ fontSize, color: fontColor, fontWeight, textAlign: align as any }}
              spellCheck={false}
              aria-label="Edit node text"
            />
          ) : (
            <span
              className="inline-block w-full truncate leading-[1.2]"
              style={{ fontSize, color: fontColor, fontWeight, textAlign: align as any }}
            >
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
