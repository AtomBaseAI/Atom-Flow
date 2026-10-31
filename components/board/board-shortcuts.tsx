"use client"

import { useEffect, useRef } from "react"
import { type Edge, type Node, useReactFlow } from "@xyflow/react"

type Snapshot = { nodes: Node[]; edges: Edge[] }

const MAX_HISTORY = 100

function isEditingText(): boolean {
  if (typeof document === "undefined") return false
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === "input" || tag === "textarea") return true
  if (el.isContentEditable) return true
  return false
}

// Stable fingerprint of a snapshot for dedupe / no-op detection.
// Only meaningful content is compared (id, position, type, data, style).
function snapshotKey(s: Snapshot): string {
  return JSON.stringify({
    n: s.nodes.map((n) => ({
      i: n.id,
      p: n.position,
      t: n.type,
      d: n.data,
      s: n.style,
    })),
    e: s.edges.map((e) => ({
      i: e.id,
      s: e.source,
      t: e.target,
      st: e.style,
      d: e.data,
      a: e.animated,
    })),
  })
}

// Deep-clone helper for clipboard payloads (data/style are plain JSON-safe
// objects). Freezes the snapshot so later edits to the source element cannot
// leak into a paste.
function deepClone<T>(value: T): T {
  if (value === undefined) return value
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value)
    } catch {
      // fall through to the JSON clone below
    }
  }
  return JSON.parse(JSON.stringify(value))
}

// Resolves a node's CURRENT on-canvas size with a fallback chain:
// explicit width/height (written by NodeResizer) → measured (actual rendered
// size) → style (size at creation). Resizing never updates node.style, so
// relying on style alone would paste the pre-resize dimensions.
function resolveNodeSize(n: Node): { width?: number; height?: number } {
  const width = n.width ?? n.measured?.width ?? (n.style?.width as number | undefined)
  const height = n.height ?? n.measured?.height ?? (n.style?.height as number | undefined)
  return { width, height }
}

function cloneNodesWithOffset(nodes: Node[], offset = { x: 24, y: 24 }): Node[] {
  const now = Date.now()
  return nodes.map((n, i) => {
    const id = `node_${now}_${i}_${Math.random().toString(36).slice(2, 7)}`
    const { width, height } = resolveNodeSize(n)
    return {
      ...n,
      id,
      position: { x: (n.position?.x ?? 0) + offset.x, y: (n.position?.y ?? 0) + offset.y },
      selected: false,
      // Carry the exact current size on the node fields AND the inline style
      // (React Flow renders `node.width ?? node.style.width`) so the pasted
      // element keeps the copied element's dimensions.
      width,
      height,
      style: { ...(n.style ?? {}), width, height },
      dragHandle: n.dragHandle,
      // Fresh deep copy of data: fill, border color/style/width, label, text
      // color/size/weight, rotation, icon source… all preserved as-is.
      data: deepClone(n.data),
      // Strip transient state so React Flow measures the clone fresh
      measured: undefined,
      dragging: false,
      resizing: false,
    }
  })
}

export default function BoardShortcuts({ locked = false }: { locked?: boolean }) {
  const rf = useReactFlow()
  // Mirrored into a ref so the once-bound keyboard listeners always read the
  // current lock state without re-subscribing.
  const lockedRef = useRef(locked)
  useEffect(() => {
    lockedRef.current = locked
  }, [locked])
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null)
  const pasteBumpRef = useRef(0)

  const historyPast = useRef<Snapshot[]>([])
  const historyFuture = useRef<Snapshot[]>([])
  const pressedRef = useRef<Record<string, boolean>>({})
  const restoringRef = useRef(false) // flag to indicate undo/redo is restoring state

  // Selection is read LIVE from the React Flow store at the moment the key is
  // pressed. The store is the single source of truth for `node.selected` /
  // `edge.selected` (single click, shift+click and box selection all write it),
  // whereas a cached selection snapshot from a hook can be empty or stale —
  // which is exactly what broke group copy/paste before.
  const getSelectedFromStore = () => {
    const nodes = rf.getNodes().filter((n) => n.selected)
    const selectedIds = new Set(nodes.map((n) => n.id))
    const edges = rf.getEdges().filter((e) => e.selected)
    return { nodes, edges, selectedIds }
  }

  const takeSnapshot = (): Snapshot => ({
    nodes: rf.getNodes().map((n) => {
      // Strip transient/internal fields so they don't pollute history comparisons
      const { dragging, resizing, measured, ...rest } = n as any
      return { ...rest, selected: false } as Node
    }),
    edges: rf.getEdges().map((e) => ({ ...e, selected: false })),
  })

  const commit = () => {
    // Never record snapshots while an undo/redo restore is in flight
    if (restoringRef.current || (typeof window !== "undefined" && (window as any).__boardRestoring)) return
    const cur = takeSnapshot()
    const last = historyPast.current[historyPast.current.length - 1]
    if (last && snapshotKey(last) === snapshotKey(cur)) {
      // State hasn't meaningfully changed since the last commit — skip
      return
    }
    historyPast.current.push(cur)
    if (historyPast.current.length > MAX_HISTORY) {
      historyPast.current.shift()
    }
    historyFuture.current.length = 0
  }

  const applySnapshot = (snap: Snapshot) => {
    restoringRef.current = true
    ;(window as any).__boardRestoring = true
    rf.setNodes(snap.nodes.map((n) => ({ ...n, dragging: false, resizing: false })))
    rf.setEdges(snap.edges)
    // Release suppression after the frame so change handlers can settle
    requestAnimationFrame(() => {
      restoringRef.current = false
      ;(window as any).__boardRestoring = false
    })
  }

  const undo = () => {
    if (restoringRef.current) return
    const current = takeSnapshot()
    // Skip no-op entries (commits that didn't change anything) so undo never
    // feels stuck, then restore the first meaningful previous state.
    while (historyPast.current.length > 0) {
      const prev = historyPast.current.pop()!
      if (snapshotKey(prev) === snapshotKey(current)) continue
      historyFuture.current.push(current)
      applySnapshot(prev)
      return
    }
  }

  const redo = () => {
    if (restoringRef.current) return
    const current = takeSnapshot()
    while (historyFuture.current.length > 0) {
      const next = historyFuture.current.pop()!
      if (snapshotKey(next) === snapshotKey(current)) continue
      historyPast.current.push(current)
      applySnapshot(next)
      return
    }
  }

  const onCopy = () => {
    const { nodes: selectedNodes, selectedIds } = getSelectedFromStore()
    if (selectedNodes.length === 0) return
    // Group copy: every selected node PLUS the edges that live entirely
    // inside the selection (so a pasted group keeps its internal wiring).
    const freshEdges = rf
      .getEdges()
      .filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target))
    clipboardRef.current = {
      nodes: selectedNodes.map((n) => deepClone(n)),
      edges: freshEdges.map((e) => deepClone(e)),
    }
    pasteBumpRef.current = 0
  }

  const onPaste = () => {
    if (!clipboardRef.current) return
    commit()
    pasteBumpRef.current += 1
    const bump = 24 * pasteBumpRef.current
    const oldNodes = clipboardRef.current.nodes
    const oldEdges = clipboardRef.current.edges
    const newNodes = cloneNodesWithOffset(oldNodes, { x: bump, y: bump })

    const idMap = new Map<string, string>()
    oldNodes.forEach((old, idx) => idMap.set(old.id, newNodes[idx].id))

    const now = Date.now()
    const newEdges: Edge[] = oldEdges
      .map((e, i) => {
        const newSource = idMap.get(e.source)
        const newTarget = idMap.get(e.target)
        if (!newSource || !newTarget) return null
        return {
          ...e,
          id: `edge_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          source: newSource,
          target: newTarget,
          selected: false,
        } as Edge
      })
      .filter(Boolean) as Edge[]

    rf.addNodes(newNodes)
    if (newEdges.length) rf.addEdges(newEdges)
  }

  const onDelete = () => {
    const { nodes: selectedNodes, edges: selectedEdges, selectedIds } = getSelectedFromStore()
    const selectedEdgeIds = new Set(selectedEdges.map((e) => e.id))
    if (selectedNodes.length === 0 && selectedEdgeIds.size === 0) return
    commit()
    rf.setNodes(rf.getNodes().filter((n) => !selectedIds.has(n.id)))
    rf.setEdges(
      rf
        .getEdges()
        .filter((e) => !selectedEdgeIds.has(e.id) && !selectedIds.has(e.source) && !selectedIds.has(e.target)),
    )
  }

  const clearAll = () => {
    commit()
    rf.setNodes([])
    rf.setEdges([])
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = (e.key?.length === 1 ? e.key.toLowerCase() : e.key) as string
      const ctrlOrMeta = !!(e.ctrlKey || e.metaKey)
      const editing = isEditingText()
      if (editing) return
      // View-only lock: undo/redo/copy/paste/delete would all mutate the board
      if (lockedRef.current) return

      if (ctrlOrMeta && (key === "z" || key === "y" || key === "c" || key === "v")) {
        if (pressedRef.current[key]) {
          e.preventDefault()
          return
        }
        pressedRef.current[key] = true
      }

      // Undo / Redo
      if (ctrlOrMeta && key === "z") {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }
      if (ctrlOrMeta && key === "y") {
        e.preventDefault()
        redo()
        return
      }

      // Copy / Paste
      if (ctrlOrMeta && key === "c") {
        e.preventDefault()
        onCopy()
        return
      }
      if (ctrlOrMeta && key === "v") {
        e.preventDefault()
        onPaste()
        return
      }

      // Delete
      if (key === "Delete" || key === "Backspace" || key === "backspace") {
        e.preventDefault()
        onDelete()
        return
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const key = (e.key?.length === 1 ? e.key.toLowerCase() : e.key) as string
      pressedRef.current[key] = false
    }

    // Capture phase to avoid other handlers stopping propagation
    const opts: AddEventListenerOptions = { capture: true }
    window.addEventListener("keydown", handler, opts)
    window.addEventListener("keyup", onKeyUp, opts)
    return () => {
      window.removeEventListener("keydown", handler, opts)
      window.removeEventListener("keyup", onKeyUp, opts)
    }
    // Handlers read all state live from the React Flow store, so binding once
    // is safe (and avoids re-subscribe churn on every selection change).
  }, [])

  useEffect(() => {
    const onUndo: EventListener = () => {
      if (lockedRef.current) return
      undo()
    }
    const onRedo: EventListener = () => {
      if (lockedRef.current) return
      redo()
    }
    const onClear: EventListener = () => {
      if (lockedRef.current) return
      clearAll()
    }
    const onCommit: EventListener = () => commit()

    window.addEventListener("board:undo", onUndo)
    window.addEventListener("board:redo", onRedo)
    window.addEventListener("board:clear", onClear)
    window.addEventListener("board:commit", onCommit)

    return () => {
      window.removeEventListener("board:undo", onUndo)
      window.removeEventListener("board:redo", onRedo)
      window.removeEventListener("board:clear", onClear)
      window.removeEventListener("board:commit", onCommit)
    }
  }, [])

  // Keyboard/shortcut controller — renders nothing
  return null
}
