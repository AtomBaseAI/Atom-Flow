"use client"

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Handle, Position, NodeResizer, useReactFlow } from "@xyflow/react"
import { Minus, Plus } from "lucide-react"
import type { Node, NodeProps } from "@xyflow/react"
import type { ShapeData } from "../design-board"
import { loadLucideRegistry, type LucideIconComp } from "@/lib/lucide-icon-registry"
import { cn, withAlpha } from "@/lib/utils"

/** Resolved (opacity-applied) background for a shape. "No color" stays transparent. */
function resolvedFill(data: ShapeData, fallback = "transparent"): string {
  return withAlpha(data.fill ?? fallback, data.fillOpacity)
}

function Handles({ visible }: { visible: boolean }) {
  const cls = visible ? "opacity-100" : "opacity-0 group-hover:opacity-60"
  return (
    <>
      {/* Unique per-handle ids are REQUIRED: React Flow resolves the snapped
          handle by `data-id="{flowId}-{nodeId}-{handleId}-{type}"`; without ids
          all handles of a node share the same data-id and the connection
          preview always snaps to the first one in DOM order (right). */}
      <Handle
        id="src-right"
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-[var(--af-handle)] ${cls}`}
        type="source"
        position={Position.Right}
      />
      <Handle
        id="src-left"
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-[var(--af-handle)] ${cls}`}
        type="source"
        position={Position.Left}
      />
      <Handle
        id="src-top"
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-[var(--af-handle)] ${cls}`}
        type="source"
        position={Position.Top}
      />
      <Handle
        id="src-bottom"
        className={`z-20 pointer-events-auto h-2 w-2 rounded bg-[var(--af-handle)] ${cls}`}
        type="source"
        position={Position.Bottom}
      />
      {/* NOTE: no target-type handles. The board uses connectionMode="loose",
          where every source handle can also end a connection — target handles
          would just overlap the source ones, steal the pointer-down (they sit
          later in DOM order), and force role-swapped connections whose handle
          ids cannot resolve as an edge source (React Flow error #008). */}
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
    if (editing) {
      // Snapshot the pre-edit state once so the label change is undoable
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("board:commit"))
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [editing, onEditingChange])

  const commit = useCallback(
    (val: string) => {
      rf.setNodes((nds: any[]) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: val } } : n)))
      setEditing(false)
    },
    [id, rf],
  )

  const style = {
    // "Default" text falls back to the theme token — flips white ⇄ dark with
    // the theme. Custom (user-picked) colors are literal values and never flip.
    color: data.fontColor || "var(--af-node-text)",
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
          className="w-full rounded px-1 outline-none"
          style={{ ...style, background: "var(--af-edit-bg)" }}
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

const LUCIDE_PREFIX = "lucide:"

/** Renders a Lucide icon by kebab name; resolves lazily from the shared registry. */
function LucideGlyph({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  const [loaded, setLoaded] = useState<{ name: string; Comp: LucideIconComp | null }>({ name: "", Comp: null })

  useEffect(() => {
    let alive = true
    loadLucideRegistry()
      .then((reg) => {
        if (!alive) return
        const entry = reg.byName.get(name) ?? reg.byName.get(reg.byAlias.get(name) ?? "")
        setLoaded({ name, Comp: entry?.comp ?? null })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [name])

  const Comp = loaded.name === name ? loaded.Comp : null

  if (!Comp) {
    return <span className="inline-block h-4 w-4 animate-pulse rounded bg-neutral-300" aria-hidden />
  }
  return <Comp className={className} style={style} aria-hidden />
}

/** Shared icon renderer for icon nodes — supports /vectors/*.svg and lucide:* sources. */
function IconGlyph({
  iconSrc,
  color,
  fillClass,
}: {
  iconSrc: string
  color?: string
  fillClass?: string
}) {
  if (!iconSrc) {
    return <div className="text-xs text-neutral-400">No icon</div>
  }
  if (iconSrc.startsWith(LUCIDE_PREFIX)) {
    return (
      <LucideGlyph
        name={iconSrc.slice(LUCIDE_PREFIX.length)}
        className={fillClass ?? "h-[90%] w-[90%]"}
        style={{ color: color ?? "var(--af-node-border)" }}
      />
    )
  }
  return (
    <img
      src={iconSrc || "/placeholder.svg"}
      alt="icon"
      className={fillClass ? `${fillClass} object-contain` : "object-contain"}
      style={fillClass ? undefined : { height: "90%", width: "90%" }}
      draggable={false}
    />
  )
}

export const RectangleNode = memo(function RectangleNode({ id, data, selected }: NodeProps<Node<ShapeData>>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = resolvedFill(data)
  // Default border = theme token (flips with theme); custom stays literal
  const borderColor = data.borderColor || "var(--af-node-border)"

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

export const EllipseNode = memo(function EllipseNode({ id, data, selected }: NodeProps<Node<ShapeData>>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = resolvedFill(data)
  const borderColor = data.borderColor || "var(--af-node-border)"

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

export const TriangleNode = memo(function TriangleNode({ id, data, selected }: NodeProps<Node<ShapeData>>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = resolvedFill(data)
  const borderColor = data.borderColor || "var(--af-node-border)"

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
            // SVG presentation attributes cannot resolve var() — apply stroke via style
            style={{
              stroke: borderColor,
              strokeWidth: data.borderWidth ?? 1,
              strokeDasharray: data.borderStyle === "dashed" ? "6 6" : undefined,
            }}
          />
        </svg>
        <EditableLabel id={id} data={data} align="center" onEditingChange={setIsEditing} />
        <Handles visible={!!selected && !isEditing} />
      </div>
    </div>
  )
})

export const DiamondNode = memo(function DiamondNode({ id, data, selected }: NodeProps<Node<ShapeData>>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = resolvedFill(data)
  const borderColor = data.borderColor || "var(--af-node-border)"

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
            style={{
              stroke: borderColor,
              strokeWidth: data.borderWidth ?? 1,
              strokeDasharray: data.borderStyle === "dashed" ? "6 6" : undefined,
            }}
          />
        </svg>
        <EditableLabel id={id} data={data} align="center" onEditingChange={setIsEditing} />
        <Handles visible={!!selected && !isEditing} />
      </div>
    </div>
  )
})

export const HexagonNode = memo(function HexagonNode({ id, data, selected }: NodeProps<Node<ShapeData>>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = resolvedFill(data)
  const borderColor = data.borderColor || "var(--af-node-border)"

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
            style={{
              stroke: borderColor,
              strokeWidth: data.borderWidth ?? 1,
              strokeDasharray: data.borderStyle === "dashed" ? "6 6" : undefined,
            }}
          />
        </svg>
        <EditableLabel id={id} data={data} align="center" onEditingChange={setIsEditing} />
        <Handles visible={!!selected && !isEditing} />
      </div>
    </div>
  )
})

export const TextNode = memo(function TextNode({ id, data, selected }: NodeProps<Node<ShapeData>>) {
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

export const IconNode = memo(function IconNode({ id, data, selected }: NodeProps<Node<ShapeData & { iconSrc?: string }>>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = resolvedFill(data)
  const borderColor = data.borderColor || "var(--af-node-border)"
  const iconSrc = data.iconSrc || ""
  // "plain" = bare icon (no bottom label strip); legacy/undefined = labeled
  const plain = data.iconVariant === "plain"

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
        {plain ? (
          <div className="flex h-full min-h-0 w-full items-center justify-center p-1">
            <IconGlyph iconSrc={iconSrc} color={borderColor} fillClass="h-[90%] w-[90%]" />
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 basis-[75%] flex items-center justify-center p-1">
              <IconGlyph iconSrc={iconSrc} color={borderColor} fillClass="h-[90%] w-[90%]" />
            </div>

            <div className="relative flex-none basis-[25%] min-h-[32px] border-t border-[rgba(0,0,0,0.08)]">
              <EditableLabel id={id} data={data} align={data.align ?? "center"} onEditingChange={setIsEditing} />
            </div>
          </>
        )}
      </div>
      {/* Handles live OUTSIDE the overflow-hidden body — inside they get
          clipped and the connection drag never reaches them. */}
      <Handles visible={!!selected && !isEditing} />
    </div>
  )
})

/**
 * App-window style icon frame (default 80×60): title at the top-left,
 * icon in the top-right corner, resizable and connectable like any shape.
 * Double-click the title to rename it.
 */
export const IconFrameNode = memo(function IconFrameNode({
  id,
  data,
  selected,
}: NodeProps<Node<ShapeData & { iconSrc?: string }>>) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rf = useReactFlow()
  const borderColor = data.borderColor || "var(--af-node-border)"
  const iconSrc = data.iconSrc || ""
  // Corner icon is a square at least 2× the title font size (default title 8px → 16×16 icon)
  const frameIconSize = Math.max(16, (data.fontSize ?? 8) * 2)

  // Window body uses the theme card color unless the user picked a fill
  const userFill = data.fill && data.fill !== "transparent" ? data.fill : undefined
  const bg = userFill ? withAlpha(userFill, data.fillOpacity) : "var(--af-frame-bg)"

  useEffect(() => {
    if (editing) {
      // Snapshot pre-edit state once so the title change is undoable
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("board:commit"))
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [editing])

  const commit = useCallback(
    (val: string) => {
      rf.setNodes((nds: any[]) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: val } } : n)))
      setEditing(false)
    },
    [id, rf],
  )

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && !editing}
        color="#22d3ee"
        minWidth={60}
        minHeight={40}
        lineStyle={{ strokeWidth: 1 }}
      />
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[4px]"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
          background: bg,
          borderColor,
          borderStyle: data.borderStyle || "solid",
          borderWidth: data.borderWidth ?? 1,
          boxSizing: "border-box",
          boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
        }}
      >
        {/* Title bar — title top-left, icon top-right */}
        <div className="flex flex-none items-center justify-between gap-1 border-b border-black/10 px-1 py-0.5 dark:border-white/15">
          <div
            className="min-w-0 flex-1"
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
                className="w-full rounded-sm px-0.5 outline-none"
                style={{
                  background: "var(--af-edit-bg)",
                  color: data.fontColor || "var(--af-node-text)",
                  fontWeight: data.fontWeight ?? 600,
                  fontSize: (data.fontSize ?? 8) + "px",
                }}
                spellCheck={false}
                aria-label="Edit frame title"
              />
            ) : (
              <span
                className="block w-full truncate leading-[1.2]"
                style={{
                  color: data.fontColor || "var(--af-node-text)",
                  fontWeight: data.fontWeight ?? 600,
                  fontSize: (data.fontSize ?? 8) + "px",
                  textAlign: "left",
                }}
              >
                {data.label || ""}
              </span>
            )}
          </div>
          <div className="flex-none" aria-hidden style={{ width: frameIconSize, height: frameIconSize }}>
            {iconSrc ? <IconGlyph iconSrc={iconSrc} color={borderColor} fillClass="h-full w-full" /> : null}
          </div>
        </div>

        {/* Window body */}
        <div className="min-h-0 flex-1" />
      </div>
      {/* Handles live OUTSIDE the overflow-hidden body — inside they get
          clipped and the connection drag never reaches them. */}
      <Handles visible={!!selected && !editing} />
    </div>
  )
})

export const TagNode = memo(function TagNode({ id, data, selected }: NodeProps<Node<ShapeData>>) {
  const [isEditing, setIsEditing] = useState(false)
  const fill = resolvedFill(data)
  const borderColor = data.borderColor || "var(--af-node-border)"

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
          data={{ ...data, fontWeight: data.fontWeight ?? 600 }}
          align={data.align ?? "center"}
          onEditingChange={setIsEditing}
        />
      </div>
    </div>
  )
})

export const LineNode = memo(function LineNode({ data, selected }: NodeProps<Node<ShapeData>>) {
  const borderColor = data.borderColor || "var(--af-node-border)"
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

/* ------------------------------------------------------------------ */
/* Table element                                                       */
/* ------------------------------------------------------------------ */

/** Tiny button used by the table's add/remove row/col strip. */
function TableCtrlBtn({
  onClick,
  label,
  children,
  disabled,
}: {
  onClick: () => void
  label: string
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex h-5 w-5 items-center justify-center rounded-sm text-foreground hover:bg-accent disabled:opacity-30"
    >
      {children}
    </button>
  )
}

/**
 * Spreadsheet-style table element: header row + body cells, every cell
 * editable in place (double-click), rows/columns addable/removable from the
 * mini strip shown while the node is selected. Fully resizable & connectable.
 */
export const TableNode = memo(function TableNode({ id, data, selected }: NodeProps<Node<ShapeData>>) {
  const [editingCell, setEditingCell] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rf = useReactFlow()

  const rows = Math.max(1, Math.min(24, data.tableRows ?? 3))
  const cols = Math.max(1, Math.min(8, data.tableCols ?? 3))
  const rawCells = data.tableCells ?? []
  const cellAt = (r: number, c: number) => rawCells[r * cols + c] ?? ""

  const fill = resolvedFill(data)
  const borderColor = data.borderColor || "var(--af-node-border)"
  const cellFontSize = (data.fontSize ?? 8) + "px"
  const textColor = data.fontColor || "var(--af-node-text)"
  const align = data.align ?? "left"

  useEffect(() => {
    if (editingCell !== null) {
      // Snapshot the pre-edit state once so cell text changes are undoable
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("board:commit"))
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [editingCell])

  const commitCell = useCallback(
    (idx: number, val: string) => {
      rf.setNodes((nds: any[]) =>
        nds.map((n) => {
          if (n.id !== id) return n
          // Pad defensively so editing a cell beyond a legacy/short array works
          const next = (n.data.tableCells ?? []).slice()
          while (next.length <= idx) next.push("")
          next[idx] = val
          return { ...n, data: { ...n.data, tableCells: next } }
        }),
      )
      setEditingCell(null)
    },
    [id, rf],
  )

  /** Structural change helper (add/remove row/col) — undoable via board:commit. */
  const mutateTable = useCallback(
    (nextRows: number, nextCols: number, nextCells: string[]) => {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("board:commit"))
      rf.setNodes((nds: any[]) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: { ...n.data, tableRows: nextRows, tableCols: nextCols, tableCells: nextCells },
              }
            : n,
        ),
      )
      setEditingCell(null)
    },
    [id, rf],
  )

  const addRow = () => mutateTable(rows + 1, cols, [...rawCells.slice(0, rows * cols), ...Array(cols).fill("")])
  const removeRow = () => {
    if (rows <= 1) return
    mutateTable(rows - 1, cols, rawCells.slice(0, (rows - 1) * cols))
  }
  const addCol = () =>
    mutateTable(
      rows,
      cols + 1,
      Array.from({ length: rows }, (_, r) => [
        ...rawCells.slice(r * cols, r * cols + cols),
        "",
      ]).flat(),
    )
  const removeCol = () => {
    if (cols <= 1) return
    mutateTable(
      rows,
      cols - 1,
      Array.from({ length: rows }, (_, r) => rawCells.slice(r * cols, r * cols + cols - 1)).flat(),
    )
  }

  const headerText: CSSProperties = {
    color: textColor,
    fontSize: cellFontSize,
    fontWeight: data.fontWeight ?? 600,
    textAlign: align as any,
  }
  const bodyText: CSSProperties = {
    color: textColor,
    fontSize: cellFontSize,
    fontWeight: data.fontWeight ?? 400,
    textAlign: align as any,
  }

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && editingCell === null}
        color="#22d3ee"
        minWidth={160}
        minHeight={96}
        lineStyle={{ strokeWidth: 1 }}
      />
      <div
        className="relative flex h-full w-full flex-col"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
          background: fill,
          borderColor,
          borderStyle: data.borderStyle || "solid",
          borderWidth: data.borderWidth ?? 1,
          boxSizing: "border-box",
          borderRadius: 2,
        }}
      >
        <div
          className="grid min-h-0 flex-1 overflow-hidden rounded-[2px]"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: rows * cols }, (_, i) => {
            const r = Math.floor(i / cols)
            const c = i % cols
            const isHeader = r === 0
            const editing = editingCell === i
            return (
              <div
                key={i}
                className={cn(
                  "relative flex min-w-0 items-center overflow-hidden px-1.5",
                  isHeader && "bg-black/[0.05] dark:bg-white/[0.08]",
                  c < cols - 1 && "border-r border-black/10 dark:border-white/10",
                  r < rows - 1 && "border-b border-black/10 dark:border-white/10",
                )}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  setEditingCell(i)
                }}
              >
                {editing ? (
                  <input
                    ref={inputRef}
                    defaultValue={cellAt(r, c)}
                    onBlur={(e) => {
                      e.stopPropagation()
                      commitCell(i, e.target.value)
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === "Enter") {
                        e.preventDefault()
                        commitCell(i, (e.target as HTMLInputElement).value)
                      }
                      if (e.key === "Escape") {
                        e.preventDefault()
                        setEditingCell(null)
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full rounded-sm outline-none"
                    style={{ ...bodyText, background: "var(--af-edit-bg)" }}
                    spellCheck={false}
                    aria-label={`Edit table cell row ${r + 1} column ${c + 1}`}
                  />
                ) : (
                  <span className="w-full truncate leading-[1.35]" style={isHeader ? headerText : bodyText}>
                    {cellAt(r, c)}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Structure strip — visible only while selected & not editing a cell */}
        {selected && editingCell === null && (
          <div
            className="absolute bottom-1 right-1 z-10 flex items-center gap-0.5 rounded-md border border-border bg-popover/95 p-0.5 shadow-md backdrop-blur"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <TableCtrlBtn onClick={addRow} label="Add row">
              <Plus className="h-3 w-3" />
              <span className="sr-only">row</span>
            </TableCtrlBtn>
            <TableCtrlBtn onClick={removeRow} label="Remove row" disabled={rows <= 1}>
              <Minus className="h-3 w-3" />
              <span className="sr-only">row</span>
            </TableCtrlBtn>
            <span className="mx-0.5 h-3 w-px bg-border" aria-hidden />
            <TableCtrlBtn onClick={addCol} label="Add column">
              <Plus className="h-3 w-3" />
              <span className="sr-only">column</span>
            </TableCtrlBtn>
            <TableCtrlBtn onClick={removeCol} label="Remove column" disabled={cols <= 1}>
              <Minus className="h-3 w-3" />
              <span className="sr-only">column</span>
            </TableCtrlBtn>
          </div>
        )}
      </div>
      {/* Handles live OUTSIDE the body — inside they get clipped and the
          connection drag never reaches them. */}
      <Handles visible={!!selected && editingCell === null} />
    </div>
  )
})

/* ------------------------------------------------------------------ */
/* Code snippet element                                                */
/* ------------------------------------------------------------------ */

const CODE_KEYWORDS = new Set([
  "abstract","as","async","await","break","case","catch","class","const","continue","debugger","declare","default","delete","do","else","enum","export","extends","false","finally","for","from","function","get","if","implements","import","in","instanceof","interface","is","let","new","null","of","private","protected","public","readonly","return","satisfies","set","static","super","switch","this","throw","true","try","type","typeof","undefined","var","void","while","with","yield",
  "def","elif","except","lambda","None","nonlocal","not","or","pass","raise","self","and",
  "fn","impl","mut","pub","struct","trait","use","where","match","loop","crate","dyn",
  "func","go","defer","chan","map","range","select","package",
  "end","then","do","begin","nil",
  "SELECT","FROM","WHERE","INSERT","INTO","VALUES","UPDATE","DELETE","JOIN","LEFT","RIGHT","INNER","OUTER","GROUP","ORDER","BY","HAVING","LIMIT","CREATE","TABLE","DROP","ALTER",
])

/**
 * Lightweight line-based tokenizer for the code snippet element.
 * Handles comments (// and #), strings, numbers, keywords and calls —
 * plenty for diagram annotations, zero dependencies.
 */
function highlightCodeLine(line: string, lineIdx: number): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\/\/.*$|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  const push = (key: string, cls: string | undefined, text: string) =>
    out.push(
      cls ? (
        <span key={key} className={cls}>
          {text}
        </span>
      ) : (
        <span key={key}>{text}</span>
      ),
    )

  while ((m = re.exec(line))) {
    if (m.index > last) push(`${lineIdx}-${k++}`, undefined, line.slice(last, m.index))
    const tok = m[0]
    if (m[1]) push(`${lineIdx}-${k++}`, "italic text-muted-foreground/60", tok)
    else if (m[2]) push(`${lineIdx}-${k++}`, "text-emerald-600 dark:text-emerald-400", tok)
    else if (m[3]) push(`${lineIdx}-${k++}`, "text-amber-600 dark:text-amber-400", tok)
    else if (CODE_KEYWORDS.has(tok)) push(`${lineIdx}-${k++}`, "text-fuchsia-600 dark:text-fuchsia-400", tok)
    else if (line[m.index + tok.length] === "(") push(`${lineIdx}-${k++}`, "text-teal-600 dark:text-teal-400", tok)
    else if (/^[A-Z]/.test(tok)) push(`${lineIdx}-${k++}`, "text-teal-700 dark:text-teal-300", tok)
    else push(`${lineIdx}-${k++}`, undefined, tok)
    last = m.index + tok.length
  }
  if (last < line.length) push(`${lineIdx}-${k++}`, undefined, line.slice(last))
  return out
}

/**
 * Editor-card style code snippet: title bar (mac dots + filename, editable
 * via double-click) over a monospace, lightly syntax-highlighted body.
 * Double-click the body to edit; Esc cancels, Ctrl/⌘+Enter or blur saves.
 */
export const CodeNode = memo(function CodeNode({
  id,
  data,
  selected,
}: NodeProps<Node<ShapeData>>) {
  const [editing, setEditing] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const rf = useReactFlow()

  const fill = resolvedFill(data)
  const borderColor = data.borderColor || "var(--af-node-border)"
  const userFill = data.fill && data.fill !== "transparent" ? data.fill : undefined
  const bodyBg = userFill ? withAlpha(userFill, data.fillOpacity) : "var(--af-frame-bg)"
  const code = typeof data.code === "string" ? data.code : ""
  // Language badge follows the filename's extension (e.g. index.js → JS,
  // script.py → PY) instead of a static value. A leading dot (".gitignore"),
  // a trailing dot or a missing dot fall back to the stored codeLang.
  const fileName = data.label ?? ""
  const dotIdx = fileName.lastIndexOf(".")
  const fileExt = dotIdx > 0 ? fileName.slice(dotIdx + 1).trim().slice(0, 10) : ""
  const codeLang = fileExt || data.codeLang || "code"
  const codeFontSize = (data.fontSize ?? 9) + "px"
  const baseText = { color: data.fontColor || "var(--af-node-text)" }
  const lines = code.split("\n")

  useEffect(() => {
    if (editing) {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("board:commit"))
      requestAnimationFrame(() => {
        bodyRef.current?.focus()
        bodyRef.current?.setSelectionRange(bodyRef.current.value.length, bodyRef.current.value.length)
      })
    }
  }, [editing])

  useEffect(() => {
    if (editingTitle) {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("board:commit"))
      requestAnimationFrame(() => titleRef.current?.focus())
    }
  }, [editingTitle])

  const commit = useCallback(
    (patch: Partial<ShapeData>) => {
      rf.setNodes((nds: any[]) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
    },
    [id, rf],
  )

  return (
    <div className="group relative h-full w-full p-[3px]">
      <NodeResizer
        isVisible={selected && !editing && !editingTitle}
        color="#22d3ee"
        minWidth={220}
        minHeight={140}
        lineStyle={{ strokeWidth: 1 }}
      />
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[4px]"
        style={{
          transform: `rotate(${data.rotation ?? 0}deg)`,
          transformOrigin: "center",
          background: bodyBg,
          borderColor,
          borderStyle: data.borderStyle || "solid",
          borderWidth: data.borderWidth ?? 1,
          boxSizing: "border-box",
          boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
        }}
      >
        {/* Title bar — mac dots + filename + language badge */}
        <div className="flex flex-none items-center gap-1.5 border-b border-black/10 bg-black/[0.03] px-1.5 py-1 dark:border-white/15 dark:bg-white/[0.06]">
          <span className="flex flex-none items-center gap-1" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-red-400/80" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          </span>
          <div className="min-w-0 flex-1" onDoubleClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setEditingTitle(true)
          }}>
            {editingTitle ? (
              <input
                ref={titleRef}
                defaultValue={data.label || ""}
                onBlur={(e) => {
                  e.stopPropagation()
                  commit({ label: e.target.value })
                  setEditingTitle(false)
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === "Enter") {
                    e.preventDefault()
                    commit({ label: (e.target as HTMLInputElement).value })
                    setEditingTitle(false)
                  }
                  if (e.key === "Escape") {
                    e.preventDefault()
                    setEditingTitle(false)
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full rounded-sm px-0.5 font-mono outline-none"
                style={{ background: "var(--af-edit-bg)", ...baseText, fontSize: (data.fontSize ?? 9) + "px" }}
                spellCheck={false}
                aria-label="Edit snippet filename"
              />
            ) : (
              <span
                className="block w-full truncate font-mono leading-[1.3]"
                style={{ ...baseText, fontSize: (data.fontSize ?? 9) + "px" }}
              >
                {data.label || "snippet"}
              </span>
            )}
          </div>
          <span className="flex-none text-[8px] font-medium uppercase tracking-wider text-muted-foreground/70">
            {codeLang}
          </span>
        </div>

        {/* Code body */}
        {editing ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <textarea
              ref={bodyRef}
              defaultValue={code}
              onBlur={(e) => {
                e.stopPropagation()
                commit({ code: e.target.value })
                setEditing(false)
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === "Escape") {
                  e.preventDefault()
                  setEditing(false)
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  commit({ code: (e.target as HTMLTextAreaElement).value })
                  setEditing(false)
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="min-h-0 w-full flex-1 resize-none bg-transparent p-1.5 font-mono leading-[1.5] outline-none"
              style={{ ...baseText, fontSize: codeFontSize }}
              spellCheck={false}
              aria-label="Edit code snippet"
            />
            <div className="flex-none border-t border-black/10 px-1.5 py-0.5 text-[9px] text-muted-foreground dark:border-white/15">
              Esc to cancel · Ctrl/⌘+Enter to save
            </div>
          </div>
        ) : (
          <div
            className="min-h-0 flex-1 cursor-text overflow-hidden p-1.5"
            onDoubleClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setEditing(true)
            }}
          >
            {code.trim() ? (
              <pre className="h-full w-full overflow-hidden font-mono leading-[1.5]" style={{ fontSize: codeFontSize }}>
                {lines.map((line, i) => (
                  <div key={i} className="flex">
                    <span
                      className="w-5 flex-none select-none pr-1.5 text-right text-muted-foreground/50"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <code className="whitespace-pre" style={baseText}>
                      {highlightCodeLine(line, i)}
                    </code>
                  </div>
                ))}
              </pre>
            ) : (
              <span className="font-mono text-muted-foreground/60" style={{ fontSize: codeFontSize }}>
                {"// double-click to edit code"}
              </span>
            )}
          </div>
        )}
      </div>
      {/* Handles live OUTSIDE the overflow-hidden body — inside they get
          clipped and the connection drag never reaches them. */}
      <Handles visible={!!selected && !editing && !editingTitle} />
    </div>
  )
})
