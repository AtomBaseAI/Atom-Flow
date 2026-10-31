"use client"

import type React from "react"
import * as htmlToImage from "html-to-image"
import { useCallback, useMemo, useRef, useState, useEffect, useSyncExternalStore } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type NodeTypes,
  MarkerType,
  ConnectionMode,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import LeftToolbar from "./left-toolbar"
import BottomToolbar from "./bottom-toolbar"
import {
  HexagonNode,
  DiamondNode,
  TriangleNode,
  EllipseNode,
  RectangleNode,
  TextNode,
  IconNode,
  TagNode,
  LineNode,
} from "./nodes"
import SmartEdge from "./edges/smart-edge"
import SmartConnectionLine from "./edges/smart-connection-line"
import BoardShortcuts from "./board-shortcuts"
import { Download, Trash2, Hand, Upload, Image as ImageIcon, FileCode, Braces, Maximize2, Minimize2, Plus, MousePointer2, Scan, Lock, LockOpen, Square, Grid3x3, Grip } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import RadialMenu, { type RadialMenuItem } from "./radial-menu"
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler"
import { useTheme } from "next-themes"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Tool = "select" | "rect" | "ellipse" | "text" | "hand" | "tag" | "line"

export type ShapeData = {
  label?: string
  fill?: string
  /** Fill opacity multiplier (0–1). Undefined = fully opaque. */
  fillOpacity?: number
  fontColor?: string
  /** True once the user explicitly picked a text color — it then survives
      theme switches (only DEFAULT text/borders flip with the theme). */
  fontColorCustom?: boolean
  align?: "left" | "center" | "right"
  fontWeight?: number
  fontSize?: number
  borderColor?: string
  /** True once the user explicitly picked a border color — survives theme
      switches (only DEFAULT borders flip with the theme). */
  borderColorCustom?: boolean
  borderStyle?: "solid" | "dashed"
  borderWidth?: number
  iconSrc?: string
  rotation?: number
}

const initialNodes: Node<ShapeData>[] = [
  {
    id: "n-1",
    type: "rectangle",
    position: { x: 200, y: 180 },
    data: {
      label: "",
      fill: "transparent",
      fontSize: 8,
      fontWeight: 400,
      align: "center",
      borderStyle: "solid",
      borderWidth: 1,
    },
    style: { width: 140, height: 56 },
  },
]

const initialEdges: Edge[] = []

// Unique id for programmatically created nodes — Date.now() alone collides
// when several elements are created within the same millisecond (e.g. rapid
// double-adds), which corrupts the node lookup.
let nodeSeq = 0
function newNodeId(): string {
  nodeSeq += 1
  return `n-${Date.now().toString(36)}-${nodeSeq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

// ---- Layout persistence (localStorage) ----
const STORAGE_KEY = "atomflow:board:v1"

// View-only lock mode (persists across reloads): hides the editing chrome,
// forces the hand tool and freezes node/edge interactions while panning and
// zooming stay available.
const LOCK_STORAGE_KEY = "atomflow:board:locked:v1"

// The lock flag lives in localStorage (an external system), so it is exposed
// through useSyncExternalStore: no setState-in-effect, and the server snapshot
// (unlocked) prevents hydration mismatches while still re-rendering locked
// right after hydration when the stored flag is "1".
const lockListeners = new Set<() => void>()

function subscribeLock(onChange: () => void) {
  lockListeners.add(onChange)
  return () => {
    lockListeners.delete(onChange)
  }
}

function getLockedSnapshot(): boolean {
  try {
    return window.localStorage.getItem(LOCK_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function getLockedServerSnapshot(): boolean {
  return false
}

function writeLocked(next: boolean) {
  try {
    window.localStorage.setItem(LOCK_STORAGE_KEY, next ? "1" : "0")
  } catch {
    // storage unavailable — the mode still applies for this session
  }
  lockListeners.forEach((listener) => listener())
}

// Background layout variant ("plain" | "grid" | "dots"): also persisted in
// localStorage and exposed via useSyncExternalStore, same pattern as the lock
// flag — server snapshot (plain) avoids hydration mismatches.
type BoardBgVariant = "plain" | "grid" | "dots"

const BG_STORAGE_KEY = "atomflow:board:bg:v1"
const BG_ORDER: BoardBgVariant[] = ["plain", "grid", "dots"]
const BG_LABELS: Record<BoardBgVariant, string> = {
  plain: "Plain",
  grid: "Grid",
  dots: "Dotted",
}

const bgListeners = new Set<() => void>()

function subscribeBg(onChange: () => void) {
  bgListeners.add(onChange)
  return () => {
    bgListeners.delete(onChange)
  }
}

function getBgSnapshot(): BoardBgVariant {
  try {
    const v = window.localStorage.getItem(BG_STORAGE_KEY)
    return v === "grid" || v === "dots" ? v : "plain"
  } catch {
    return "plain"
  }
}

function getBgServerSnapshot(): BoardBgVariant {
  return "plain"
}

function writeBg(next: BoardBgVariant) {
  try {
    window.localStorage.setItem(BG_STORAGE_KEY, next)
  } catch {
    // storage unavailable — the variant still applies for this session
  }
  bgListeners.forEach((listener) => listener())
}

type PersistedBoard = {
  version: 1
  savedAt: string
  nodes: Node<ShapeData>[]
  edges: Edge[]
  viewport?: { x: number; y: number; zoom: number }
}

// Removes runtime-only fields React Flow attaches to nodes/edges so the
// stored payload stays canonical (same shape as an exported JSON file).
function stripTransientNode(n: Node): Node {
  const { measured, selected, dragging, resizing, events, className, ...rest } = n as any
  return rest as Node
}

function stripTransientEdge(e: Edge): Edge {
  const { selected, ...rest } = e as any
  return rest as Edge
}

// ---- Theme-aware default colors -----------------------------------------
// Old boards stored the *default* border/text colors as literal hex values
// ("#a3a3a3" border, "#ffffff" text). Those now map to "no explicit color",
// so they render from the --af-* CSS variables and flip with the theme.
// Any other stored value is treated as a user-picked color and marked custom
// so it stays fixed across theme switches.
const LEGACY_DEFAULT_BORDER = "#a3a3a3"
const LEGACY_DEFAULT_TEXT = "#ffffff"

function migrateShapeDefaults(raw: Record<string, any> | undefined): Record<string, any> {
  const data = { ...(raw ?? {}) }
  const border = typeof data.borderColor === "string" ? data.borderColor.toLowerCase() : undefined
  if (!data.borderColorCustom && (!border || border === LEGACY_DEFAULT_BORDER)) {
    delete data.borderColor
  } else if (data.borderColor) {
    data.borderColorCustom = true
  }
  const font = typeof data.fontColor === "string" ? data.fontColor.toLowerCase() : undefined
  if (!data.fontColorCustom && (!font || font === LEGACY_DEFAULT_TEXT)) {
    delete data.fontColor
  } else if (data.fontColor) {
    data.fontColorCustom = true
  }
  return data
}

function migrateEdgeDefaults(e: Record<string, any>): Record<string, any> {
  const next: Record<string, any> = { ...e }
  const style = { ...(e.style ?? {}) }
  if (typeof style.stroke === "string" && style.stroke.toLowerCase() === LEGACY_DEFAULT_BORDER) {
    delete style.stroke
  }
  next.style = style
  const marker = next.markerEnd
  if (marker && typeof marker === "object" && typeof marker.color === "string" && marker.color.toLowerCase() === LEGACY_DEFAULT_BORDER) {
    const markerEnd = { ...marker }
    delete markerEnd.color
    next.markerEnd = markerEnd
  }
  return next
}

const nodeTypes: NodeTypes = {
  rectangle: RectangleNode,
  ellipse: EllipseNode,
  triangle: TriangleNode,
  diamond: DiamondNode,
  hexagon: HexagonNode,
  text: TextNode,
  icon: IconNode,
  tag: TagNode,
  line: LineNode as any,
}

// Accepts a finite number (or numeric string) and returns it, otherwise undefined.
function pickSize(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : (value as number)
  return typeof n === "number" && Number.isFinite(n) ? n : undefined
}

// Resolves a node's CURRENT on-canvas size with a fallback chain:
// explicit width/height (written by NodeResizer) → measured (actual rendered
// size) → style (size at creation). Resizing never updates node.style, so a
// round trip that kept only style would silently reset resized elements to
// their creation dimensions.
function resolveNodeSizeRecord(record: Record<string, any>): { width?: number; height?: number } {
  const width = pickSize(record.width) ?? pickSize(record.measured?.width) ?? pickSize(record.style?.width)
  const height = pickSize(record.height) ?? pickSize(record.measured?.height) ?? pickSize(record.style?.height)
  return { width, height }
}

function sanitizeImportPayload(raw: unknown): {
  nodes: Node<ShapeData>[]
  edges: Edge[]
  viewport?: { x: number; y: number; zoom: number }
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error('expected a JSON object with a "nodes" array')
  }
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.nodes)) {
    throw new Error('missing "nodes" array')
  }
  const validTypes = new Set(Object.keys(nodeTypes))
  const stamp = Date.now()
  const nodes: Node<ShapeData>[] = (obj.nodes as Record<string, any>[]).map((n, i) => {
    const record = (n ?? {}) as Record<string, any>
    // Restore the exact exported size: prefer the resized width/height, then
    // the measured size, then the creation style — and keep style in sync so
    // React Flow (node.width ?? node.style.width) renders the same box.
    const { width, height } = resolveNodeSizeRecord(record)
    return {
      id: typeof record.id === "string" && record.id ? record.id : `n-import-${stamp}-${i}`,
      type: validTypes.has(record.type) ? record.type : "rectangle",
      position: {
        x: Number.isFinite(Number(record.position?.x)) ? Number(record.position.x) : 0,
        y: Number.isFinite(Number(record.position?.y)) ? Number(record.position.y) : 0,
      },
      data: migrateShapeDefaults(record.data),
      style: {
        ...(record.style ?? {}),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      },
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      // Deliberately no `measured` — it belongs to the exporting session and
      // React Flow re-measures the node on mount.
      selected: false,
      dragging: false,
      resizing: false,
    } as unknown as Node<ShapeData>
  })
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges: Edge[] = (Array.isArray(obj.edges) ? (obj.edges as Record<string, any>[]) : [])
    .filter(
      (e) =>
        e &&
        typeof e.source === "string" &&
        typeof e.target === "string" &&
        nodeIds.has(e.source) &&
        nodeIds.has(e.target) &&
        e.source !== e.target,
    )
    .map((e, i) => ({
      ...migrateEdgeDefaults(e),
      id: typeof e.id === "string" && e.id ? e.id : `e-import-${stamp}-${i}`,
      type: typeof e.type === "string" && e.type ? e.type : "smart",
      selected: false,
    })) as Edge[]
  const viewport = obj.viewport as { x: number; y: number; zoom: number } | undefined
  return { nodes, edges, viewport }
}

function BoardInner() {
  const [tool, setTool] = useState<Tool>("select")
  // View-only lock: hides all editing UI, forces the hand tool and freezes elements
  const locked = useSyncExternalStore(subscribeLock, getLockedSnapshot, getLockedServerSnapshot)
  // Canvas background layout: plain (default) / grid / dotted — cycles via the
  // button next to the theme toggler and persists across reloads.
  const bgVariant = useSyncExternalStore(subscribeBg, getBgSnapshot, getBgServerSnapshot)
  // Radial (circular) tap menu — opened via right-click / two-finger tap
  const [radialOpen, setRadialOpen] = useState(false)
  const [radialPos, setRadialPos] = useState<{ x: number; y: number } | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ShapeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  // View-only mode: id of the node highlighted by the last tap/click (layout stays frozen)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)

  const rf = useReactFlow()
  const { resolvedTheme } = useTheme()
  const connectStartIdRef = useRef<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const [exportOpen, setExportOpen] = useState(false)
  const [exportTitle, setExportTitle] = useState("diagram")
  const [exportType, setExportType] = useState<"png" | "svg" | "json">("png")

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState("")
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Fullscreen support: native Fullscreen API first, CSS fallback when blocked (e.g. sandboxed iframes)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  useEffect(() => {
    if (!pseudoFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPseudoFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pseudoFullscreen])

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return
    if (document.fullscreenElement) {
      setPseudoFullscreen(false)
      try {
        await document.exitFullscreen()
      } catch {}
      return
    }
    try {
      await document.documentElement.requestFullscreen()
      setPseudoFullscreen(false)
    } catch {
      // Fullscreen API unavailable/blocked — fall back to CSS fullscreen
      setPseudoFullscreen((p) => !p)
    }
  }, [])

  // View-only lock: while locked only the hand tool is active, every editing
  // surface is hidden and elements cannot be moved/edited until unlocked.
  const toggleLocked = useCallback(() => {
    const next = !locked
    writeLocked(next)
    if (next) {
      // Force the hand tool so the user can still pan/zoom the frozen board,
      // and drop any active selection/highlight along with the radial menu.
      setTool("hand")
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      setHighlightedNodeId(null)
      setRadialOpen(false)
      setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)))
      setEdges((eds) => eds.map((e) => (e.selected ? { ...e, selected: false } : e)))
    } else {
      // Back to the normal editing default
      setTool("select")
      setHighlightedNodeId(null)
    }
  }, [locked, setNodes, setEdges])

  // Background layout switcher: cycles plain → grid → dotted → plain and
  // persists the choice (see BG_ORDER / writeBg).
  const cycleBgVariant = useCallback(() => {
    const next = BG_ORDER[(BG_ORDER.indexOf(bgVariant) + 1) % BG_ORDER.length]
    writeBg(next)
  }, [bgVariant])

  const resizeActiveRef = useRef(false)

  const commitHistory = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("board:commit"))
    }
  }, [])

  // ---- Layout persistence: restore once on mount, then autosave (debounced) ----
  const hydratedRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)

  const persistNow = useCallback(() => {
    if (!hydratedRef.current || typeof window === "undefined") return
    try {
      const payload: PersistedBoard = {
        version: 1,
        savedAt: new Date().toISOString(),
        // Canonicalized exactly like the JSON export (resolved sizes on both
        // width/height and style) so storage and export files are the same
        // shape and restore identically through sanitizeImportPayload().
        nodes: rf.getNodes().map((n) => {
          const stripped = stripTransientNode(n)
          const { width, height } = resolveNodeSizeRecord(stripped as any)
          return {
            ...stripped,
            ...(width !== undefined ? { width } : {}),
            ...(height !== undefined ? { height } : {}),
            style: {
              ...((stripped.style as any) ?? {}),
              ...(width !== undefined ? { width } : {}),
              ...(height !== undefined ? { height } : {}),
            },
          } as Node<ShapeData>
        }),
        edges: rf.getEdges().map(stripTransientEdge),
        viewport: rf.getViewport(),
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Storage unavailable (private mode / quota exceeded) — keep working in memory
    }
  }, [rf])

  const schedulePersist = useCallback(() => {
    if (typeof window === "undefined") return
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      persistNow()
    }, 350)
  }, [persistNow])

  // Restore the last session's layout. Runs before the first autosave, so the
  // pre-hydration render never overwrites what's stored.
  useEffect(() => {
    let restored = false
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        const { nodes: savedNodes, edges: savedEdges, viewport } = sanitizeImportPayload(parsed)
        setNodes(savedNodes)
        setEdges(savedEdges)
        if (viewport && Number.isFinite(viewport.x) && Number.isFinite(viewport.y) && Number.isFinite(viewport.zoom)) {
          rf.setViewport(viewport)
        }
        restored = true
      }
    } catch {
      // Corrupted storage — fall through to the starter board
    }
    if (!restored) setNodes(initialNodes)
    hydratedRef.current = true
  }, [])

  // Autosave whenever board content changes. The debounce means a drag or
  // resize (which streams changes every frame) lands as a single write.
  useEffect(() => {
    if (!hydratedRef.current) return
    schedulePersist()
  }, [nodes, edges, schedulePersist])

  // Flush pending saves when the tab is hidden or the page is being unloaded
  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      persistNow()
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("beforeunload", flush)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("beforeunload", flush)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [persistNow])

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<ShapeData>>[]) => {
      const restoring = typeof window !== "undefined" && (window as any).__boardRestoring
      if (!restoring && Array.isArray(changes)) {
        const startResize = changes.some((c) => (c as any).type === "dimensions" && (c as any).resizing === true)
        const endResize = changes.some((c) => (c as any).type === "dimensions" && (c as any).resizing === false)
        const hasRemove = changes.some((c) => (c as any).type === "remove")
        if (hasRemove || (startResize && !resizeActiveRef.current)) {
          if (startResize) resizeActiveRef.current = true
          commitHistory()
        } else if (endResize) {
          resizeActiveRef.current = false
        }
      }
      onNodesChange(changes)
    },
    [onNodesChange, commitHistory],
  )

  const suppressPaneClickRef = useRef(false)
  const touchTapRef = useRef<{
    mid: { x: number; y: number }
    t0: number
    probes: { id: number; x: number; y: number }[]
    moved: boolean
  } | null>(null)

  const openRadialMenu = useCallback((pt: { x: number; y: number }) => {
    // The radial menu shows mode-appropriate actions in BOTH editing and
    // view-only (locked) mode, so it opens in either state.
    // Swallow the synthetic pane click that can follow a two-finger tap so it
    // doesn't clear the selection or drop a shape right after opening.
    suppressPaneClickRef.current = true
    setRadialPos(pt)
    setRadialOpen(true)
  }, [])

  // Release the pane-click suppression shortly after the menu closes
  useEffect(() => {
    if (radialOpen) return
    const t = setTimeout(() => {
      suppressPaneClickRef.current = false
    }, 400)
    return () => clearTimeout(t)
  }, [radialOpen])

  // Two-finger tap detection (touch screens / tablets): record the gesture when
  // the second finger lands, cancel if it turns into a pinch or pan.
  const handleBoardTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const a = e.touches[0]
      const b = e.touches[1]
      touchTapRef.current = {
        mid: { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 },
        t0: Date.now(),
        probes: [
          { id: a.identifier, x: a.clientX, y: a.clientY },
          { id: b.identifier, x: b.clientX, y: b.clientY },
        ],
        moved: false,
      }
    } else {
      touchTapRef.current = null
    }
  }, [])

  const handleBoardTouchMove = useCallback((e: React.TouchEvent) => {
    const st = touchTapRef.current
    if (!st || st.moved) return
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]
      const p = st.probes.find((pp) => pp.id === t.identifier)
      if (!p) continue
      const dx = t.clientX - p.x
      const dy = t.clientY - p.y
      if (dx * dx + dy * dy > 144) {
        st.moved = true
        break
      }
    }
  }, [])

  const handleBoardTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const st = touchTapRef.current
      if (!st) return
      if (e.touches.length > 0) return
      touchTapRef.current = null
      if (st.moved || Date.now() - st.t0 > 400) return
      openRadialMenu(st.mid)
    },
    [openRadialMenu],
  )

  const getBoardScreenCenter = useCallback(() => {
    const el = boardRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    return {
      x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
      y: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
    }
  }, [])

  // Creates a node at the given screen position (used by quick add + radial menu)
  const createNodeAt = useCallback(
    (t: "rect" | "ellipse" | "text" | "tag" | "line", screenPos: { x: number; y: number }) => {
      const pos = rf.screenToFlowPosition(screenPos)
      const id = newNodeId()
      const nodeType = t === "rect" ? "rectangle" : t === "ellipse" ? "ellipse" : t

      const data: ShapeData = {
        label: t === "text" ? "Text" : "",
        fill: "transparent",
        fontSize: 8,
        fontWeight: t === "tag" ? 600 : 400,
        align: t === "text" ? "left" : "center",
        borderStyle: "solid",
        borderWidth: t === "line" ? 2 : 1,
      }

      const style =
        t === "text"
          ? { width: 120, height: 28 }
          : t === "tag"
            ? { width: 96, height: 28 }
            : t === "line"
              ? { width: 140, height: 4 }
              : { width: 140, height: 56 }

      const newNode: Node<ShapeData> = { id, type: nodeType as any, position: pos, data, style }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("board:commit"))
      }
      setNodes((nds) => nds.concat(newNode))
      setSelectedNodeId(id)
      setTool("select")
    },
    [rf, setNodes],
  )

  const quickAdd = useCallback(
    (t: "rect" | "ellipse" | "text" | "tag" | "line") => createNodeAt(t, getBoardScreenCenter()),
    [createNodeAt, getBoardScreenCenter],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      let src = connection.source!
      let tgt = connection.target!
      let srcHandle = connection.sourceHandle ?? null
      let tgtHandle = connection.targetHandle ?? null

      const started = connectStartIdRef.current
      if (started && started === tgt) {
        // If React Flow labeled the start handle as "target", flip so the arrow points from start -> end
        ;[src, tgt] = [tgt, src]
        // Handle ids must follow the swap, otherwise the edge cannot resolve
        // its endpoints (React Flow error #008)
        ;[srcHandle, tgtHandle] = [tgtHandle, srcHandle]
      }

      const srcNode = src ? rf.getNode(src) : null
      const srcZ = srcNode?.zIndex ?? 0

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("board:commit"))
      }

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            source: src,
            target: tgt,
            sourceHandle: srcHandle,
            targetHandle: tgtHandle,
            type: "smart",
            style: { strokeWidth: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 6, height: 6 },
            animated: false,
            data: { style: "solid" as const },
            zIndex: srcZ,
          },
          eds,
        ),
      )
      connectStartIdRef.current = null
    },
    [setEdges, rf],
  )

  const onConnectStart = useCallback((_evt: any, params: { nodeId?: string | null }) => {
    connectStartIdRef.current = params?.nodeId ?? null
  }, [])

  const onConnectEnd = useCallback(() => {
    connectStartIdRef.current = null
  }, [])

  const handlePaneClick = useCallback(
    (evt: React.MouseEvent) => {
      // Ignore the click that synthetic events can fire right after a two-finger tap
      if (suppressPaneClickRef.current) {
        suppressPaneClickRef.current = false
        return
      }
      // View-only mode: pane clicks highlight the element under the cursor
      // (layout stays frozen) instead of selecting it.
      if (locked) {
        setSelectedEdgeId(null)
        const clickPos = rf.screenToFlowPosition({ x: evt.clientX, y: evt.clientY })
        const allNodes = rf.getNodes()
        let hitId: string | null = null
        // Later nodes render on top — scan from the end to find the topmost hit
        for (let i = allNodes.length - 1; i >= 0; i--) {
          const n = allNodes[i]
          const w = (n.measured?.width ?? (n.style?.width as number | undefined)) ?? 0
          const h = (n.measured?.height ?? (n.style?.height as number | undefined)) ?? 0
          if (!w || !h) continue
          if (
            clickPos.x >= n.position.x &&
            clickPos.x <= n.position.x + w &&
            clickPos.y >= n.position.y &&
            clickPos.y <= n.position.y + h
          ) {
            hitId = n.id
            break
          }
        }
        setHighlightedNodeId(hitId)
        return
      }
      const pos = rf.screenToFlowPosition({ x: evt.clientX, y: evt.clientY })

      if (tool === "rect" || tool === "ellipse" || tool === "text" || tool === "tag" || tool === "line") {
        const id = newNodeId()
        const base: Node<ShapeData> = {
          id,
          position: pos,
          data: {
            label: tool === "text" ? "Text" : "",
            fill: "transparent",
            fontSize: 8,
            fontWeight: tool === "tag" ? 600 : 400,
            align: tool === "text" ? "left" : "center",
            borderStyle: "solid",
            borderWidth: tool === "line" ? 2 : 1,
          },
          style:
            tool === "text"
              ? { width: 120, height: 28 }
              : tool === "tag"
                ? { width: 96, height: 28 }
                : tool === "line"
                  ? { width: 140, height: 4 }
                  : { width: 140, height: 56 },
          type:
            tool === "rect"
              ? "rectangle"
              : tool === "ellipse"
                ? "ellipse"
                : tool === "text"
                  ? "text"
                  : tool === "tag"
                    ? "tag"
                    : tool === "line"
                      ? "line"
                      : "rectangle",
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("board:commit"))
        }
        setNodes((nds) => nds.concat(base))
        setSelectedNodeId(id)
        setTool("select")
        return
      }
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
    },
    [rf, tool, setNodes, locked],
  )

  const handlePaneDoubleClick = useCallback(
    (evt: React.MouseEvent) => {
      // View-only mode: no double-click text creation
      if (locked) return
      // React Flow v12 has no onPaneDoubleClick prop, so we listen on the board
      // wrapper and only react to double clicks on the empty pane background.
      const target = evt.target as HTMLElement | null
      if (!target || typeof target.closest !== "function") return
      if (
        target.closest(
          ".react-flow__node, .react-flow__edge, .react-flow__handle, .react-flow__controls, .react-flow__minimap, .react-flow__attribution, button, input, textarea",
        ) ||
        !target.closest(".react-flow__pane")
      ) {
        return
      }

      const pos = rf.screenToFlowPosition({ x: evt.clientX, y: evt.clientY })
      const id = newNodeId()
      const newTextNode: Node<ShapeData> = {
        id,
        type: "text",
        position: pos,
        data: {
          label: "Text",
          fill: "transparent",
          fontSize: 8,
          fontWeight: 400,
          align: "left",
          borderStyle: "solid",
          borderWidth: 1,
        },
        style: { width: 120, height: 28 },
      }

      // Commit history before mutation to align with edge creation behavior
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("board:commit"))
      }

      setNodes((nds) => nds.concat(newTextNode))
      setSelectedNodeId(id)
      setTool("select")
    },
    [rf, setNodes, locked],
  )

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
      setSelectedNodeId(selectedNodes?.[0]?.id ?? null)
      setSelectedEdgeId(selectedEdges?.[0]?.id ?? null)
    },
    [],
  )

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId])

  const updateSelectedNode = useCallback(
    (patch: Partial<ShapeData>) => {
      if (!selectedNodeId) return
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("board:commit"))
      }
      setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n)))
    },
    [selectedNodeId, setNodes],
  )

  // Same as updateSelectedNode but without recording a history entry — used by
  // continuous controls (sliders) which commit once at drag start instead.
  const updateSelectedNodeSilent = useCallback(
    (patch: Partial<ShapeData>) => {
      if (!selectedNodeId) return
      setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n)))
    },
    [selectedNodeId, setNodes],
  )

  const changeSelectedNodeType = useCallback(
    (newType: keyof typeof nodeTypes) => {
      if (!selectedNodeId) return
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("board:commit"))
      }
      setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, type: newType } : n)))
    },
    [selectedNodeId, setNodes],
  )

  const setSelectedEdge = useCallback(
    (patch: Partial<Edge>) => {
      if (!selectedEdgeId) return
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("board:commit"))
      }
      setEdges((eds) => eds.map((e) => (e.id === selectedEdgeId ? { ...e, ...patch } : e)))
    },
    [selectedEdgeId, setEdges],
  )

  const setSelectedEdgeStyle = useCallback(
    (stylePatch: React.CSSProperties) => {
      if (!selectedEdgeId) return
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("board:commit"))
      }
      setEdges((eds) =>
        eds.map((e) => (e.id === selectedEdgeId ? { ...e, style: { ...(e.style || {}), ...stylePatch } } : e)),
      )
    },
    [selectedEdgeId, setEdges],
  )

  const handleEdgesChange = useCallback(
    (changes: any) => {
      const suppress = typeof window !== "undefined" && (window as any).__boardRestoring

      if (!suppress && Array.isArray(changes) && changes.some((c) => c?.type === "remove")) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("board:commit"))
        }
      }
      onEdgesChange(changes)
    },
    [onEdgesChange],
  )

  const exportDiagram = useCallback(async () => {
    try {
      if (exportType === "json") {
        // Canonical, portable export: resolve each node's effective size into
        // width/height AND style, and drop transient fields (measured,
        // selected, dragging…) that belong to the current session only.
        const canonicalNodes = nodes.map((n) => {
          const { measured, selected, dragging, resizing, events, className, ...rest } = n as any
          const { width, height } = resolveNodeSizeRecord(n as any)
          return {
            ...rest,
            ...(width !== undefined ? { width } : {}),
            ...(height !== undefined ? { height } : {}),
            style: {
              ...(rest.style ?? {}),
              ...(width !== undefined ? { width } : {}),
              ...(height !== undefined ? { height } : {}),
            },
          }
        })
        const canonicalEdges = edges.map(({ selected, ...e }) => e as Edge)
        const payload = {
          nodes: canonicalNodes,
          edges: canonicalEdges,
          viewport: rf.getViewport?.() ?? undefined,
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${exportTitle || "diagram"}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        setExportOpen(false)
        return
      }

      const el = boardRef.current
      if (!el) return

      if (exportType === "png") {
        const dataUrl = await htmlToImage.toPng(el, {
          pixelRatio: Math.min(2, window.devicePixelRatio || 1.5),
          backgroundColor: resolvedTheme === "dark" ? "#000000" : "#ffffff",
          cacheBust: true,
        })
        const a = document.createElement("a")
        a.href = dataUrl
        a.download = `${exportTitle || "diagram"}.png`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setExportOpen(false)
      } else if (exportType === "svg") {
        const dataUrl = await htmlToImage.toSvg(el, {
          backgroundColor: resolvedTheme === "dark" ? "#000000" : "#ffffff",
          cacheBust: true,
        })
        const res = await fetch(dataUrl)
        const svgText = await res.text()
        const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${exportTitle || "diagram"}.svg`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        setExportOpen(false)
      }
    } catch (err) {
      console.error("[v0] export failed", err)
    }
  }, [exportType, exportTitle, nodes, edges, rf, resolvedTheme])

  const onImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    setImportFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setImportText(String(reader.result ?? ""))
    reader.onerror = () => setImportError("Could not read the selected file")
    reader.readAsText(file)
    e.target.value = ""
  }, [])

  const submitImport = useCallback(() => {
    try {
      const raw = JSON.parse(importText)
      const { nodes: importedNodes, edges: importedEdges, viewport } = sanitizeImportPayload(raw)
      commitHistory()
      rf.setNodes(importedNodes)
      rf.setEdges(importedEdges)
      if (viewport && Number.isFinite(viewport.x) && Number.isFinite(viewport.y) && Number.isFinite(viewport.zoom)) {
        rf.setViewport(viewport)
      }
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      setImportOpen(false)
      setImportError(null)
      setImportText("")
      setImportFileName(null)
    } catch (err: any) {
      setImportError(err?.message ? `Import failed: ${err.message}` : "Import failed: invalid JSON")
    }
  }, [importText, rf, commitHistory])

  const radialItems: RadialMenuItem[] = useMemo(() => {
    // Shared by both modes — label/icon reflect the current fullscreen state
    const fullscreenItem: RadialMenuItem = {
      id: "fullscreen",
      label: isFullscreen || pseudoFullscreen ? "Exit fullscreen" : "Fullscreen",
      icon: isFullscreen || pseudoFullscreen ? Minimize2 : Maximize2,
      onSelect: () => {
        void toggleFullscreen()
      },
    }
    const fitViewItem: RadialMenuItem = {
      id: "fitview",
      label: "Fit view",
      icon: Scan,
      onSelect: () => rf.fitView?.({ padding: 0.2, duration: 300 }),
    }

    // View-only (locked) mode: compact menu — unlock / fullscreen / fit view
    if (locked) {
      return [
        {
          id: "unlock",
          label: "Unlock",
          icon: LockOpen,
          onSelect: toggleLocked,
        },
        fullscreenItem,
        fitViewItem,
      ]
    }

    return [
      {
        id: "add",
        label: "Add shape",
        icon: Plus,
        onSelect: () => {
          if (radialPos) createNodeAt("rect", radialPos)
        },
      },
      {
        id: "select",
        label: "Select",
        icon: MousePointer2,
        active: tool === "select",
        onSelect: () => setTool("select"),
      },
      {
        id: "hand",
        label: "Hand",
        icon: Hand,
        active: tool === "hand",
        onSelect: () => setTool("hand"),
      },
      fitViewItem,
      {
        id: "lock",
        label: "Lock board",
        icon: Lock,
        onSelect: toggleLocked,
      },
      fullscreenItem,
    ]
  }, [locked, radialPos, tool, rf, createNodeAt, toggleLocked, toggleFullscreen, isFullscreen, pseudoFullscreen])

  // In view-only mode the tapped element gets a teal highlight ring. The ring
  // is a transient className on the node wrapper — stripped before persistence
  // and export so it never leaks into saved boards.
  const displayNodes = useMemo(
    () =>
      nodes.map((n) =>
        n.id === highlightedNodeId
          ? ({ ...n, className: "board-locked-highlight" } as Node<ShapeData>)
          : n.className
            ? ({ ...n, className: undefined } as Node<ShapeData>)
            : n,
      ),
    [nodes, highlightedNodeId],
  )

  return (
    <div
      className={cn(
        "relative h-full min-h-0 w-full overflow-hidden",
        pseudoFullscreen && "fixed inset-0 z-[60] h-dvh w-screen",
      )}
      style={{ background: "var(--af-board-bg)" }}
    >
      {/* Left tool rail — entirely hidden in view-only mode */}
      {!locked && (
      <LeftToolbar
        active={tool as "select" | "rect" | "ellipse" | "text" | "hand"}
        onChangeTool={setTool}
        onQuickAdd={quickAdd}
        onZoomIn={() => rf.zoomIn?.() ?? rf.setViewport({ ...rf.getViewport(), zoom: rf.getViewport().zoom * 1.1 })}
        onZoomOut={() => rf.zoomOut?.() ?? rf.setViewport({ ...rf.getViewport(), zoom: rf.getViewport().zoom / 1.1 })}
        onFitView={() => {
          rf.fitView?.({ padding: 0.2, duration: 300 })
        }}
        onOpenExport={() => setExportOpen(true)}
        onAddIcon={(data) => {
          const pos = rf.screenToFlowPosition(getBoardScreenCenter())
          const id = newNodeId()
          const newNode: Node<ShapeData> = {
            id,
            type: "icon" as any,
            position: pos,
            data: {
              label: data.label || "",
              iconSrc: data.src,
              fill: "transparent",
              fontSize: 8,
              fontWeight: 700,
              align: "center",
              borderStyle: "solid",
              borderWidth: 1,
            },
            style: { width: 96, height: 96 },
          }
          commitHistory()
          setNodes((nds) => nds.concat(newNode))
          setSelectedNodeId(id)
          setTool("select")
        }}
        onAddTag={() => {
          const pos = rf.screenToFlowPosition(getBoardScreenCenter())
          const id = newNodeId()
          const newNode: Node<ShapeData> = {
            id,
            type: "tag" as any,
            position: pos,
            data: {
              label: "tag",
              fill: "transparent",
              fontSize: 8,
              fontWeight: 600,
              align: "center",
              borderStyle: "solid",
              borderWidth: 1,
            },
            style: { width: 96, height: 28 },
          }
          commitHistory()
          setNodes((nds) => nds.concat(newNode))
          setSelectedNodeId(id)
          setTool("select")
        }}
      />
      )}

      {/* Top-left: fullscreen toggle + theme switcher + background layout switcher */}
      <div className="pointer-events-auto absolute left-4 top-4 z-20 flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={isFullscreen || pseudoFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                onClick={toggleFullscreen}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {isFullscreen || pseudoFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" sideOffset={6}>
              {isFullscreen || pseudoFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </TooltipContent>
          </Tooltip>
          <AnimatedThemeToggler />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Background: ${BG_LABELS[bgVariant]}`}
                aria-pressed={bgVariant !== "plain"}
                onClick={cycleBgVariant}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {bgVariant === "plain" ? (
                  <Square className="h-4 w-4" />
                ) : bgVariant === "grid" ? (
                  <Grid3x3 className="h-4 w-4" />
                ) : (
                  <Grip className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" sideOffset={6}>
              Background: {BG_LABELS[bgVariant]} — click for{" "}
              {BG_LABELS[BG_ORDER[(BG_ORDER.indexOf(bgVariant) + 1) % BG_ORDER.length]]}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Bottom-left: view-only lock toggle — one of the only controls that
          stays visible (together with fullscreen) while the board is locked */}
      <div className="pointer-events-auto absolute bottom-4 left-4 z-30 flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={locked ? "Unlock board" : "Lock board"}
                aria-pressed={locked}
                onClick={toggleLocked}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card focus:outline-none focus:ring-2 focus:ring-teal-500",
                  locked ? "border-teal-500 text-teal-600 dark:text-white" : "border-border text-foreground hover:bg-accent",
                )}
              >
                {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" sideOffset={6}>
              {locked ? "Unlock board" : "Lock board (view only)"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {locked && (
          <span className="rounded-md border border-teal-500/60 bg-teal-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-teal-700 dark:text-teal-300">
            Locked
          </span>
        )}
      </div>

      {/* Top-right actions — editing-only, hidden while locked */}
      {!locked && (
      <div className="pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              aria-label="Clear"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-accent"
              title="Clear"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear board?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all nodes and connections from the board. You can still undo this action.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("board:clear"))
                }}
              >
                Clear
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <button
          aria-label="Import"
          onClick={() => {
            setImportError(null)
            setImportOpen(true)
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-accent"
          title="Import JSON"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Import</span>
        </button>

        <button
          aria-label="Export"
          onClick={() => setExportOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-accent"
          title="Export"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
      )}

      <div
        ref={boardRef}
        className="absolute inset-0 overflow-hidden"
        style={{ contain: "layout paint size" as React.CSSProperties["contain"] }}
        onContextMenu={(e) => {
          // Right-click / trackpad two-finger tap opens the radial menu
          e.preventDefault()
          openRadialMenu({ x: e.clientX, y: e.clientY })
        }}
        onTouchStart={handleBoardTouchStart}
        onTouchMove={handleBoardTouchMove}
        onTouchEnd={handleBoardTouchEnd}
        onDoubleClick={handlePaneDoubleClick}
      >
        <ReactFlow
          className={cn("h-full w-full", locked && "board-locked")}
          proOptions={useMemo(() => ({ hideAttribution: true }), [])}
          nodes={displayNodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          nodeTypes={nodeTypes}
          edgeTypes={useMemo(() => ({ smart: SmartEdge }), [])}
          connectionLineComponent={SmartConnectionLine}
          onPaneClick={handlePaneClick}
          onMoveEnd={schedulePersist}
          onSelectionChange={onSelectionChange}
          onEdgesDelete={(deleted) => {
            if (deleted.some((e) => e.id === selectedEdgeId)) setSelectedEdgeId(null)
          }}
          onNodesDelete={(deleted) => {
            if (deleted.some((n) => n.id === selectedNodeId)) setSelectedNodeId(null)
          }}
          selectionOnDrag={tool === "select" && !locked}
          panOnDrag={tool === "hand" || locked}
          // View-only lock: freeze every node/edge interaction, keep panning
          nodesDraggable={!locked}
          nodesConnectable={!locked}
          elementsSelectable={!locked}
          nodesFocusable={!locked}
          edgesFocusable={!locked}
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          onNodeDragStart={useCallback(() => {
            if (typeof window !== "undefined" && !(window as any).__boardRestoring) {
              window.dispatchEvent(new CustomEvent("board:commit"))
            }
          }, [])}
          defaultEdgeOptions={{
            type: "smart",
            style: { strokeWidth: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 6, height: 6 },
          }}
          elevateNodesOnSelect={false}
          connectionMode={ConnectionMode.Loose}
          isValidConnection={useCallback(
            (conn: Connection | Edge | null) => !!conn?.source && !!conn.target && conn.source !== conn.target,
            [],
          )}
          connectionRadius={24}
        >
          {/* Canvas background layout — plain (none), grid lines or dots.
              The pattern color comes from the --af-bg-pattern theme var so it
              stays subtle in both light and dark mode, and the React Flow
              pattern pans/zooms together with the viewport. */}
          {bgVariant === "grid" && (
            <Background
              variant={BackgroundVariant.Lines}
              gap={26}
              lineWidth={1}
              color="var(--af-bg-pattern)"
            />
          )}
          {bgVariant === "dots" && (
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.6}
              color="var(--af-bg-pattern)"
            />
          )}
          <BoardShortcuts locked={locked} />
        </ReactFlow>
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md border-border bg-card p-0 text-foreground shadow-xl">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="text-sm font-semibold text-foreground">Export diagram</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Download the board as an image, or save it as a JSON project file you can re-import later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1.5">
              <label htmlFor="export-title" className="text-xs font-medium text-muted-foreground">
                File name
              </label>
              <input
                id="export-title"
                value={exportTitle}
                onChange={(e) => setExportTitle(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="diagram"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Format</span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "png", label: "PNG", hint: "Raster image", icon: ImageIcon },
                    { value: "svg", label: "SVG", hint: "Vector image", icon: FileCode },
                    { value: "json", label: "JSON", hint: "Editable project", icon: Braces },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setExportType(f.value)}
                    aria-pressed={exportType === f.value}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs transition-colors",
                      exportType === f.value
                        ? "border-teal-600 bg-teal-600/10 text-teal-700 dark:text-white"
                        : "border-border bg-background text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <f.icon className="h-4 w-4" />
                    <span className="font-medium">{f.label}</span>
                    <span className="text-[10px] text-muted-foreground">{f.hint}</span>
                  </button>
                ))}
              </div>
              {exportType === "json" && (
                <p className="text-[11px] text-muted-foreground">
                  {nodes.length} node{nodes.length === 1 ? "" : "s"} · {edges.length} connection
                  {edges.length === 1 ? "" : "s"} — shapes, styles and layout are preserved.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border px-5 py-3">
            <button
              onClick={() => setExportOpen(false)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={exportDiagram}
              className="rounded-md border border-teal-600 bg-teal-600 px-3 py-1.5 text-xs text-white hover:bg-teal-500"
            >
              Export {exportType.toUpperCase()}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open)
          if (!open) setImportError(null)
        }}
      >
        <DialogContent className="max-w-md border-border bg-card p-0 text-foreground shadow-xl">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="text-sm font-semibold text-foreground">Import diagram</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Load a .json file previously exported from Atom Flow. This replaces the current board — undo still works.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-background px-4 py-6 text-center transition-colors hover:border-teal-600 hover:bg-accent">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">{importFileName || "Choose a .json file"}</span>
              <span className="text-[10px] text-muted-foreground">or paste the JSON below</span>
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label="Choose a JSON file to import"
                onChange={onImportFile}
              />
            </label>

            <div className="space-y-1.5">
              <label htmlFor="import-json" className="text-xs font-medium text-muted-foreground">
                Paste JSON
              </label>
              <textarea
                id="import-json"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={5}
                placeholder={'{ "nodes": [...], "edges": [...] }'}
                className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {importError && (
              <p role="alert" className="rounded-md border border-red-900/50 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-400">
                {importError}
              </p>
            )}
          </div>

          <DialogFooter className="border-t border-border px-5 py-3">
            <button
              onClick={() => setImportOpen(false)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={submitImport}
              disabled={!importText.trim()}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs",
                importText.trim()
                  ? "border-teal-600 bg-teal-600 text-white hover:bg-teal-500"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              Import
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomToolbar
        visible={!locked && (!!selectedNodeId || !!selectedEdgeId)}
        isNodeSelected={!!selectedNodeId}
        isEdgeSelected={!!selectedEdgeId}
        currentFill={selectedNode?.data?.fill}
        currentFillOpacity={selectedNode?.data?.fillOpacity}
        onChangeShape={changeSelectedNodeType}
        onChangeBG={(color) => updateSelectedNode({ fill: color })}
        onFillOpacityStart={commitHistory}
        onFillOpacity={(v) => updateSelectedNodeSilent({ fillOpacity: v })}
        onBorderStyle={(style) => updateSelectedNode({ borderStyle: style })}
        onBorderColor={(color) => updateSelectedNode({ borderColor: color, borderColorCustom: true })}
        onBorderWidth={(w) => updateSelectedNode({ borderWidth: w })}
        onChangeTextSize={(fontSize) => updateSelectedNode({ fontSize })}
        onChangeTextColor={(color) => updateSelectedNode({ fontColor: color, fontColorCustom: true })}
        onAlign={(align) => updateSelectedNode({ align })}
        onBold={(bold) => updateSelectedNode({ fontWeight: bold ? 700 : 400 })}
        onEdgeStyle={(style) => setSelectedEdgeStyle({ strokeDasharray: style === "dashed" ? "6 6" : "0" })}
        onEdgeColor={(color) => setSelectedEdgeStyle({ stroke: color })}
        onEdgeWidth={(w) => setSelectedEdgeStyle({ strokeWidth: w })}
        onEdgeAnimate={(animate) => setSelectedEdge({ animated: animate })}
        onRotate={(deg) => updateSelectedNode({ rotation: deg })}
        onRotateSilent={(deg) => updateSelectedNodeSilent({ rotation: deg })}
        onRotateStart={commitHistory}
      />

      {/* Animated circular menu — right-click / two-finger tap */}
      <RadialMenu
        open={radialOpen}
        position={radialPos}
        items={radialItems}
        onClose={() => setRadialOpen(false)}
      />
    </div>
  )
}

export default function DesignBoard() {
  return (
    <ReactFlowProvider>
      <BoardInner />
    </ReactFlowProvider>
  )
}
