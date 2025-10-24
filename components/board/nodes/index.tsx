"use client"

import { memo, useCallback, useEffect, useRef, useState } from "react"
import { Handle, Position, NodeResizer, useReactFlow } from "@xyflow/react"
import type { NodeProps } from "@xyflow/react"
import type { ShapeData } from "../design-board"

function Handles({ visible }: { visible: boolean }) {
  const cls = visible ? "opacity-100" : "opacity-0 group-hover:opacity-60"
  return (
    <>
      <Handle
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-zinc-200 ${cls}`}
        type="source"
        position={Position.Right}
      />
      <Handle
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-zinc-200 ${cls}`}
        type="source"
        position={Position.Left}
      />
      <Handle
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-zinc-200 ${cls}`}
        type="source"
        position={Position.Top}
      />
      <Handle
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-zinc-200 ${cls}`}
        type="source"
        position={Position.Bottom}
      />
      <Handle
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-zinc-200 ${cls}`}
        type="target"
        position={Position.Right}
      />
      <Handle
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-zinc-200 ${cls}`}
        type="target"
        position={Position.Left}
      />
      <Handle
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-zinc-200 ${cls}`}
        type="target"
        position={Position.Top}
      />
      <Handle
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-zinc-200 ${cls}`}
        type="target"
        position={Position.Bottom}
      />
    </>
  )
}

function EditableLabel({
  id,
  data,
  align = "center",
  onEditingChange,
}: {
  id: string
  data: ShapeData
  align?: "left" | "center" | "right"
  onEditingChange?: (v: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rf = useReactFlow()

  useEffect(() => {
    onEditingChange?.(editing)
    if (editing) requestAnimationFrame(() => inputRef.current?.focus())
  }, [editing, onEditingChange])

  const commit = useCallback(
    (val: string) => {
      rf.setNodes((nds: any[]) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: val } } : n)))
      setEditing(false)
    },
    [id, rf],
  )

  const style = {
    color: data.fontColor || "#ffffff",
    fontWeight: data.fontWeight ?? 400,
    fontSize: (data.fontSize ?? 8) + "px",
    textAlign: align as any,
  }

  return (
    <div
      className={`z-10 absolute inset-0 flex items-center ${
        align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center"
      } px-2`}
      onDoubleClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        setEditing(true)
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          defaultValue={data.label || ""}
          onBlur={(e) => {
            e.stopPropagation()
            commit(e.target.value)
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Enter") {
              e.preventDefault()
              commit((e.target as HTMLInputElement).value)
            }
            if (e.key === "Escape") {
              e.preventDefault()
              setEditing(false)
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full rounded bg-neutral-900/70 px-1 outline-none"
          style={style}
          spellCheck={false}
          aria-label="Edit node text"
        />
      ) : (
        <span className="inline-block w-full truncate leading-[1.2]" style={style}>
          {data.label || ""}
        </span>
      )}
    </div>
  )
}

export const RectangleNode = memo(function RectangleNode({ id, data, selected }: NodeProps<ShapeData>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = data.fill ?? "#1a1a1a"
  const borderColor = data.borderColor || "#a3a3a3"

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && !isEditing}
        color="#22d3ee"
        minWidth={60}
        minHeight={28}
        lineStyle={{ strokeWidth: 1 }}
      />
      <div
        className="relative h-full w-full overflow-visible rounded-[2px]"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
          background: fill,
          borderColor,
          borderStyle: data.borderStyle || "solid",
          borderWidth: data.borderWidth ?? 1,
          boxSizing: "border-box",
        }}
      >
        <EditableLabel id={id} data={data} align={data.align ?? "center"} onEditingChange={setIsEditing} />
        <Handles visible={!!selected && !isEditing} />
      </div>
    </div>
  )
})

export const EllipseNode = memo(function EllipseNode({ id, data, selected }: NodeProps<ShapeData>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = data.fill ?? "#1a1a1a"
  const borderColor = data.borderColor || "#a3a3a3"

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && !isEditing}
        color="#22d3ee"
        minWidth={60}
        minHeight={28}
        lineStyle={{ strokeWidth: 1 }}
      />
      <div
        className="relative h-full w-full overflow-visible rounded-full"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
          background: fill,
          borderColor,
          borderStyle: data.borderStyle || "solid",
          borderWidth: data.borderWidth ?? 1,
          boxSizing: "border-box",
        }}
      >
        <EditableLabel id={id} data={data} align="center" onEditingChange={setIsEditing} />
        <Handles visible={!!selected && !isEditing} />
      </div>
    </div>
  )
})

export const TriangleNode = memo(function TriangleNode({ id, data, selected }: NodeProps<ShapeData>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = data.fill ?? "#1a1a1a"
  const borderColor = data.borderColor || "#a3a3a3"

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && !isEditing}
        color="#22d3ee"
        minWidth={60}
        minHeight={28}
        lineStyle={{ strokeWidth: 1 }}
      />
      <div
        className="relative h-full w-full overflow-visible"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
        }}
      >
        <svg className="h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points="50,0 100,100 0,100"
            fill={fill}
            stroke={borderColor}
            strokeWidth={data.borderWidth ?? 1}
            strokeDasharray={data.borderStyle === "dashed" ? "6 6" : undefined}
          />
        </svg>
        <EditableLabel id={id} data={data} align="center" onEditingChange={setIsEditing} />
        <Handles visible={!!selected && !isEditing} />
      </div>
    </div>
  )
})

export const DiamondNode = memo(function DiamondNode({ id, data, selected }: NodeProps<ShapeData>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = data.fill ?? "#1a1a1a"
  const borderColor = data.borderColor || "#a3a3a3"

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && !isEditing}
        color="#22d3ee"
        minWidth={60}
        minHeight={28}
        lineStyle={{ strokeWidth: 1 }}
      />
      <div
        className="relative h-full w-full overflow-visible"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
        }}
      >
        <svg className="h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points="50,0 100,50 50,100 0,50"
            fill={fill}
            stroke={borderColor}
            strokeWidth={data.borderWidth ?? 1}
            strokeDasharray={data.borderStyle === "dashed" ? "6 6" : undefined}
          />
        </svg>
        <EditableLabel id={id} data={data} align="center" onEditingChange={setIsEditing} />
        <Handles visible={!!selected && !isEditing} />
      </div>
    </div>
  )
})

export const HexagonNode = memo(function HexagonNode({ id, data, selected }: NodeProps<ShapeData>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = data.fill ?? "#1a1a1a"
  const borderColor = data.borderColor || "#a3a3a3"

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && !isEditing}
        color="#22d3ee"
        minWidth={60}
        minHeight={28}
        lineStyle={{ strokeWidth: 1 }}
      />
      <div
        className="relative h-full w-full overflow-visible"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
        }}
      >
        <svg className="h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points="25,0 75,0 100,50 75,100 25,100 0,50"
            fill={fill}
            stroke={borderColor}
            strokeWidth={data.borderWidth ?? 1}
            strokeDasharray={data.borderStyle === "dashed" ? "6 6" : undefined}
          />
        </svg>
        <EditableLabel id={id} data={data} align="center" onEditingChange={setIsEditing} />
        <Handles visible={!!selected && !isEditing} />
      </div>
    </div>
  )
})

export const TextNode = memo(function TextNode({ id, data, selected }: NodeProps<ShapeData>) {
  const [isEditing, setIsEditing] = useState(false)
  const rf = useReactFlow()

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && !isEditing}
        color="#22d3ee"
        minWidth={60}
        minHeight={24}
        lineStyle={{ strokeWidth: 1 }}
      />
      <div
        className="relative h-full w-full overflow-visible rounded-[2px] border border-transparent bg-transparent"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
        }}
      >
        <EditableLabel id={id} data={data} align={data.align ?? "left"} onEditingChange={setIsEditing} />
        <Handles visible={!!selected && !isEditing} />
      </div>
    </div>
  )
})

export const IconNode = memo(function IconNode({ id, data, selected }: NodeProps<ShapeData & { iconSrc?: string }>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = data.fill ?? "#ffffff"
  const borderColor = data.borderColor || "#a3a3a3"
  const iconSrc = data.iconSrc || ""

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && !isEditing}
        color="#22d3ee"
        minWidth={72}
        minHeight={72}
        lineStyle={{ strokeWidth: 1 }}
      />
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[2px]"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
          background: fill,
          borderColor,
          borderStyle: data.borderStyle || "solid",
          borderWidth: data.borderWidth ?? 1,
          boxSizing: "border-box",
        }}
      >
        <div className="flex-1 basis-[75%] min-h-0 flex items-center justify-center p-1">
          {iconSrc ? (
            <img
              src={iconSrc || "/placeholder.svg"}
              alt="icon"
              className="max-h-full max-w-full object-contain"
              style={{ height: "90%", width: "90%" }}
              draggable={false}
            />
          ) : (
            <div className="text-xs text-neutral-400">No icon</div>
          )}
        </div>

        <div className="relative flex-none basis-[25%] min-h-[32px] border-t border-[rgba(0,0,0,0.08)]">
          <EditableLabel id={id} data={data} align={data.align ?? "center"} onEditingChange={setIsEditing} />
        </div>

        <Handles visible={!!selected && !isEditing} />
      </div>
    </div>
  )
})

export const TagNode = memo(function TagNode({ id, data, selected }: NodeProps<ShapeData>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = data.fill ?? "#e5e7eb"
  const borderColor = data.borderColor || "#a3a3a3"

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && !isEditing}
        color="#22d3ee"
        minWidth={48}
        minHeight={24}
        lineStyle={{ strokeWidth: 1 }}
      />
      <div
        className="relative h-full w-full overflow-visible rounded-full"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
          background: fill,
          borderColor,
          borderStyle: data.borderStyle || "solid",
          borderWidth: data.borderWidth ?? 1,
          boxSizing: "border-box",
        }}
      >
        <EditableLabel
          id={id}
          data={{ ...data, fontWeight: data.fontWeight ?? 600, fontColor: data.fontColor ?? "#111111" }}
          align={data.align ?? "center"}
          onEditingChange={setIsEditing}
        />
      </div>
    </div>
  )
})

export const LineNode = memo(function LineNode({ data, selected }: NodeProps<ShapeData>) {
  const borderColor = data.borderColor || "#a3a3a3"
  const borderStyle = data.borderStyle || "solid"
  const borderWidth = data.borderWidth ?? 2

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer isVisible={selected} color="#22d3ee" minWidth={40} minHeight={4} lineStyle={{ strokeWidth: 1 }} />
      <div
        className="relative h-full w-full overflow-visible"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
          borderTopColor: borderColor,
          borderTopStyle: borderStyle as any,
          borderTopWidth: borderWidth,
          boxSizing: "border-box",
          background: "transparent",
        }}
      >
        {/* No Handles for line node */}
      </div>
    </div>
  )
})
