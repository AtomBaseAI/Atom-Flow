"use client"

import type React from "react"
import * as htmlToImage from "html-to-image"
import { useCallback, useMemo, useRef, useState, useEffect } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
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
import { Download, Trash2, Type, TagIcon, Hand, Upload, Image as ImageIcon, FileCode, Braces, Maximize2, Minimize2, Plus, MousePointer2, Scan } from "lucide-react"
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
  align?: "left" | "center" | "right"
  fontWeight?: number
  fontSize?: number
  borderColor?: string
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
      fontColor: "#ffffff",
      fontSize: 8,
      fontWeight: 400,
      align: "center",
      borderColor: "#a3a3a3",
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
  const { measured, selected, dragging, resizing, events, ...rest } = n as any
  return rest as Node
}

function stripTransientEdge(e: Edge): Edge {
  const { selected, ...rest } = e as any
  return rest as Edge
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
      data: { ...(record.data ?? {}) },
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
      ...e,
      id: typeof e.id === "string" && e.id ? e.id : `e-import-${stamp}-${i}`,
      type: typeof e.type === "string" && e.type ? e.type : "smart",
      selected: false,
    })) as Edge[]
  const viewport = obj.viewport as { x: number; y: number; zoom: number } | undefined
  return { nodes, edges, viewport }
}

function BoardInner() {
  const [tool, setTool] = useState<Tool>("select")
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ShapeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const rf = useReactFlow()
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

  // Radial (circular) tap menu — opened via right-click / two-finger tap
  const [radialOpen, setRadialOpen] = useState(false)
  const [radialPos, setRadialPos] = useState<{ x: number; y: number } | null>(null)
  const suppressPaneClickRef = useRef(false)
  const touchTapRef = useRef<{
    mid: { x: number; y: number }
    t0: number
    probes: { id: number; x: number; y: number }[]
    moved: boolean
  } | null>(null)

  const openRadialMenu = useCallback((pt: { x: number; y: number }) => {
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
        fontColor: "#ffffff",
        fontSize: 8,
        fontWeight: t === "tag" ? 600 : 400,
        align: t === "text" ? "left" : "center",
        borderColor: "#a3a3a3",
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
            style: { stroke: "#a3a3a3", strokeWidth: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 6, height: 6, color: "#a3a3a3" },
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
      const pos = rf.screenToFlowPosition({ x: evt.clientX, y: evt.clientY })

      if (tool === "rect" || tool === "ellipse" || tool === "text" || tool === "tag" || tool === "line") {
        const id = newNodeId()
        const base: Node<ShapeData> = {
          id,
          position: pos,
          data: {
            label: tool === "text" ? "Text" : "",
            fill: "transparent",
            fontColor: "#ffffff",
            fontSize: 8,
            fontWeight: tool === "tag" ? 600 : 400,
            align: tool === "text" ? "left" : "center",
            borderColor: "#a3a3a3",
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
    [rf, tool, setNodes],
  )

  const handlePaneDoubleClick = useCallback(
    (evt: React.MouseEvent) => {
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
          fontColor: "#ffffff",
          fontSize: 8,
          fontWeight: 400,
          align: "left",
          borderColor: "#a3a3a3",
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
    [rf, setNodes],
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
          const { measured, selected, dragging, resizing, events, ...rest } = n as any
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
          backgroundColor: "#000000",
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
          backgroundColor: "#000000",
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
  }, [exportType, exportTitle, nodes, edges, rf])

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

  const radialItems: RadialMenuItem[] = useMemo(
    () => [
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
      {
        id: "fitview",
        label: "Fit view",
        icon: Scan,
        onSelect: () => rf.fitView?.({ padding: 0.2, duration: 300 }),
      },
      {
        id: "tag",
        label: "Tag",
        icon: TagIcon,
        onSelect: () => {
          if (radialPos) createNodeAt("tag", radialPos)
        },
      },
      {
        id: "text",
        label: "Text",
        icon: Type,
        onSelect: () => {
          if (radialPos) createNodeAt("text", radialPos)
        },
      },
    ],
    [radialPos, tool, rf, createNodeAt],
  )

  return (
    <div
      className={cn(
        "relative h-full min-h-0 w-full overflow-hidden",
        pseudoFullscreen && "fixed inset-0 z-[60] h-dvh w-screen bg-black",
      )}
    >
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
              fontColor: "#ffffff",
              fontSize: 8,
              fontWeight: 700,
              align: "center",
              borderColor: "#a3a3a3",
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
              fontColor: "#ffffff",
              fontSize: 8,
              fontWeight: 600,
              align: "center",
              borderColor: "#a3a3a3",
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

      {/* Top-left: fullscreen toggle */}
      <div className="pointer-events-auto absolute left-4 top-4 z-20 flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={isFullscreen || pseudoFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                onClick={toggleFullscreen}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {isFullscreen || pseudoFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" sideOffset={6}>
              {isFullscreen || pseudoFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              aria-label="Clear"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
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
          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          title="Import JSON"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Import</span>
        </button>

        <button
          aria-label="Export"
          onClick={() => setExportOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          title="Export"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

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
          className="h-full w-full"
          proOptions={useMemo(() => ({ hideAttribution: true }), [])}
          nodes={nodes}
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
          selectionOnDrag={tool === "select"}
          panOnDrag={tool === "hand"}
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          onNodeDragStart={useCallback(() => {
            if (typeof window !== "undefined" && !(window as any).__boardRestoring) {
              window.dispatchEvent(new CustomEvent("board:commit"))
            }
          }, [])}
          defaultEdgeOptions={{
            type: "smart",
            style: { stroke: "#a3a3a3", strokeWidth: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 6, height: 6, color: "#a3a3a3" },
          }}
          elevateNodesOnSelect={false}
          connectionMode={ConnectionMode.Loose}
          isValidConnection={useCallback(
            (conn: Connection | Edge | null) => !!conn?.source && !!conn.target && conn.source !== conn.target,
            [],
          )}
          connectionRadius={24}
        >
          <BoardShortcuts />
        </ReactFlow>
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md border-zinc-800 bg-zinc-900 p-0 text-zinc-100 shadow-xl">
          <DialogHeader className="border-b border-zinc-800 px-5 py-4">
            <DialogTitle className="text-sm font-semibold text-white">Export diagram</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Download the board as an image, or save it as a JSON project file you can re-import later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1.5">
              <label htmlFor="export-title" className="text-xs font-medium text-zinc-300">
                File name
              </label>
              <input
                id="export-title"
                value={exportTitle}
                onChange={(e) => setExportTitle(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="diagram"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-zinc-300">Format</span>
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
                        ? "border-teal-600 bg-teal-600/10 text-white"
                        : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900",
                    )}
                  >
                    <f.icon className="h-4 w-4" />
                    <span className="font-medium">{f.label}</span>
                    <span className="text-[10px] text-zinc-500">{f.hint}</span>
                  </button>
                ))}
              </div>
              {exportType === "json" && (
                <p className="text-[11px] text-zinc-500">
                  {nodes.length} node{nodes.length === 1 ? "" : "s"} · {edges.length} connection
                  {edges.length === 1 ? "" : "s"} — shapes, styles and layout are preserved.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-zinc-800 px-5 py-3">
            <button
              onClick={() => setExportOpen(false)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
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
        <DialogContent className="max-w-md border-zinc-800 bg-zinc-900 p-0 text-zinc-100 shadow-xl">
          <DialogHeader className="border-b border-zinc-800 px-5 py-4">
            <DialogTitle className="text-sm font-semibold text-white">Import diagram</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Load a .json file previously exported from Atom Flow. This replaces the current board — undo still works.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 bg-zinc-950 px-4 py-6 text-center transition-colors hover:border-teal-600 hover:bg-zinc-900">
              <Upload className="h-5 w-5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-200">{importFileName || "Choose a .json file"}</span>
              <span className="text-[10px] text-zinc-500">or paste the JSON below</span>
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label="Choose a JSON file to import"
                onChange={onImportFile}
              />
            </label>

            <div className="space-y-1.5">
              <label htmlFor="import-json" className="text-xs font-medium text-zinc-300">
                Paste JSON
              </label>
              <textarea
                id="import-json"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={5}
                placeholder={'{ "nodes": [...], "edges": [...] }'}
                className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-100 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {importError && (
              <p role="alert" className="rounded-md border border-red-900/50 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-400">
                {importError}
              </p>
            )}
          </div>

          <DialogFooter className="border-t border-zinc-800 px-5 py-3">
            <button
              onClick={() => setImportOpen(false)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
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
                  : "border-zinc-800 bg-zinc-900 text-zinc-500",
              )}
            >
              Import
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomToolbar
        visible={!!selectedNodeId || !!selectedEdgeId}
        isNodeSelected={!!selectedNodeId}
        isEdgeSelected={!!selectedEdgeId}
        currentFill={selectedNode?.data?.fill}
        currentFillOpacity={selectedNode?.data?.fillOpacity}
        onChangeShape={changeSelectedNodeType}
        onChangeBG={(color) => updateSelectedNode({ fill: color })}
        onFillOpacityStart={commitHistory}
        onFillOpacity={(v) => updateSelectedNodeSilent({ fillOpacity: v })}
        onBorderStyle={(style) => updateSelectedNode({ borderStyle: style })}
        onBorderColor={(color) => updateSelectedNode({ borderColor: color })}
        onBorderWidth={(w) => updateSelectedNode({ borderWidth: w })}
        onChangeTextSize={(fontSize) => updateSelectedNode({ fontSize })}
        onChangeTextColor={(color) => updateSelectedNode({ fontColor: color })}
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
