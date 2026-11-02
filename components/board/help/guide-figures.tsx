"use client"

/**
 * Hand-drawn SVG illustrations for the user guide — "screens" drawn as
 * vectors, never real screenshots. Every figure mirrors the actual Atom Flow
 * UI using theme tokens (card / border / muted-foreground) plus teal accents,
 * so the same drawing reads correctly in light AND dark mode.
 *
 * The tool tiles embed the REAL lucide-react icon components the board
 * renders (nested <svg> inside the figure), so each figure shows exactly the
 * same glyphs as the panel it describes — same icon, same order, same active
 * state.
 *
 * Figures are referenced from guide-content.ts via the `figure` block kind
 * and rendered by GuideFigure below.
 */

import * as React from "react"
import {
  AppWindow,
  Boxes,
  Braces,
  Circle,
  CircleHelp,
  Cloud,
  Database,
  Download,
  FileCode,
  FolderPlus as BorderAll,
  GitBranch,
  Globe,
  Grip,
  Grid3x3,
  Hand,
  Image as ImageIcon,
  Layers,
  Lock,
  LockOpen,
  Maximize2,
  Minus,
  Moon,
  MousePointer2,
  PaintBucket,
  Plus,
  RotateCw,
  Scan,
  Server,
  Shapes,
  Square,
  Sun,
  Table2,
  Tag,
  Terminal,
  Trash2,
  Type,
  Undo2,
  Redo2,
  Upload,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { GuideFigureId } from "./guide-content"

/* ---------------- shared building blocks ---------------- */

const panelCls = "fill-card stroke-border"
const canvasCls = "fill-background stroke-border"

/** Rounded canvas every figure draws on (default 360×200). */
function Frame({
  label,
  children,
  height = 200,
}: {
  label: string
  children: React.ReactNode
  height?: number
}) {
  return (
    <svg
      viewBox={`0 0 360 ${height}`}
      role="img"
      aria-label={label}
      className="block h-auto w-full"
    >
      {children}
    </svg>
  )
}

/** Teal / muted / rose arrowhead marker — must live inside <defs> with a unique id. */
function ArrowHead({ id, tone = "teal" }: { id: string; tone?: "teal" | "muted" | "rose" }) {
  const fill =
    tone === "muted"
      ? "fill-muted-foreground/60"
      : tone === "rose"
        ? "fill-rose-500"
        : "fill-teal-500"
  return (
    <marker
      id={id}
      viewBox="0 0 8 8"
      refX={7}
      refY={4}
      markerWidth={6.5}
      markerHeight={6.5}
      orient="auto-start-reverse"
    >
      <path d="M0 0L8 4L0 8Z" className={fill} />
    </marker>
  )
}

/** A UI node box with optional centered label. */
function Box({
  x,
  y,
  w,
  h,
  label,
  rx = 6,
  className,
}: {
  x: number
  y: number
  w: number
  h: number
  label?: string
  rx?: number
  className?: string
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} strokeWidth={1.5} className={cn(panelCls, className)} />
      {label !== undefined && (
        <text x={x + w / 2} y={y + h / 2 + 3} fontSize={8.5} textAnchor="middle" className="fill-foreground/80">
          {label}
        </text>
      )}
    </g>
  )
}

/** Teal selection grips on the four corners of a box. */
function Grips({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const s = 5
  const pts: Array<[number, number]> = [
    [x - s / 2, y - s / 2],
    [x + w - s / 2, y - s / 2],
    [x - s / 2, y + h - s / 2],
    [x + w - s / 2, y + h - s / 2],
  ]
  return (
    <g>
      {pts.map(([gx, gy], i) => (
        <rect
          key={i}
          x={gx}
          y={gy}
          width={s}
          height={s}
          rx={1}
          strokeWidth={1.2}
          className="fill-background stroke-teal-500"
        />
      ))}
    </g>
  )
}

/** Small in-figure annotation label. */
function Lab({
  x,
  y,
  children,
  anchor = "middle",
  size = 7.5,
  className,
}: {
  x: number
  y: number
  children: React.ReactNode
  anchor?: "start" | "middle" | "end"
  size?: number
  className?: string
}) {
  return (
    <text x={x} y={y} fontSize={size} textAnchor={anchor} className={cn("fill-muted-foreground", className)}>
      {children}
    </text>
  )
}

/** Mouse pointer arrow. */
function Cursor({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x} ${y} l0 12 l3 -2.9 l1.9 4.4 l2.4 -1 l-1.9 -4.4 l4.1 0 Z`}
      strokeWidth={1.2}
      strokeLinejoin="round"
      className="fill-foreground stroke-background"
    />
  )
}

/**
 * A rounded UI button tile with the REAL lucide icon inside (nested svg),
 * exactly the glyph the board renders for that control. `active` reproduces
 * the teal highlight the UI uses for the selected tool / panel.
 */
function Tile({
  x,
  y,
  size = 14,
  icon,
  active = false,
  tileClassName,
  iconClassName,
}: {
  x: number
  y: number
  size?: number
  icon: LucideIcon
  active?: boolean
  tileClassName?: string
  iconClassName?: string
}) {
  const iconSize = size * 0.78
  const Icon = icon
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={size * 0.26}
        strokeWidth={1.2}
        className={cn(
          active ? "fill-teal-500/15 stroke-teal-500" : "fill-card stroke-border",
          tileClassName,
        )}
      />
      <Icon
        x={x + (size - iconSize) / 2}
        y={y + (size - iconSize) / 2}
        width={iconSize}
        height={iconSize}
        aria-hidden
        className={cn(
          active ? "text-teal-600 dark:text-teal-300" : "text-foreground/75",
          iconClassName,
        )}
      />
    </g>
  )
}

/**
 * Bottom-bar pill button showing icon + tiny caption, mirroring the real
 * style-bar buttons ("Shapes", "BG", "Border", …).
 */
function BarBtn({
  x,
  y,
  w = 34,
  h = 18,
  icon,
  label,
  textGlyph,
  active = false,
}: {
  x: number
  y: number
  w?: number
  h?: number
  icon?: LucideIcon
  label?: string
  /** Renders a text glyph (e.g. "T", "Aa") instead of an icon. */
  textGlyph?: string
  active?: boolean
}) {
  const Icon = icon
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={4}
        strokeWidth={1.1}
        className={cn(active ? "fill-teal-500/15 stroke-teal-500" : "fill-background stroke-border")}
      />
      {Icon && label && (
        <>
          <Icon
            x={x + 3.5}
            y={y + (h - 9) / 2}
            width={9}
            height={9}
            aria-hidden
            className="text-teal-600 dark:text-teal-400"
          />
          <text x={x + 14} y={y + h / 2 + 2.4} fontSize={6.2} className="fill-foreground/80">
            {label}
          </text>
        </>
      )}
      {textGlyph && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 3.2}
          fontSize={9}
          fontWeight={700}
          textAnchor="middle"
          className="fill-foreground/80"
        >
          {textGlyph}
        </text>
      )}
    </g>
  )
}

/* ---------------- the real rail / clusters (shared) ---------------- */

/** Left tool rail buttons, exact order & icons of the real UI. */
const RAIL_TOOLS: { icon: LucideIcon; label: string }[] = [
  { icon: Plus, label: "Add Icon" },
  { icon: MousePointer2, label: "Select" },
  { icon: Hand, label: "Hand" },
  { icon: Square, label: "Rectangle" },
  { icon: Circle, label: "Ellipse" },
  { icon: Minus, label: "Line" },
  { icon: Tag, label: "Tag" },
  { icon: Type, label: "Text" },
  { icon: Table2, label: "Table" },
  { icon: FileCode, label: "Code" },
  { icon: ZoomIn, label: "Zoom in" },
  { icon: ZoomOut, label: "Zoom out" },
  { icon: Scan, label: "Fit view" },
  { icon: Undo2, label: "Undo" },
  { icon: Redo2, label: "Redo" },
]

/** Theme toggle renders Sun in light mode and Moon in dark mode (as the real toggler does). */
function ThemeGlyph({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g aria-hidden>
      <Sun x={x} y={y} width={size} height={size} className="text-foreground/75 dark:hidden" />
      <Moon x={x} y={y} width={size} height={size} className="hidden text-foreground/75 dark:block" />
    </g>
  )
}

/* ---------------- figures ---------------- */

function WelcomeFig() {
  return (
    <Frame label="A small architecture diagram: Frontend and API boxes connected to a Database ellipse, with a prod tag">
      <defs>
        <ArrowHead id="af-w-teal" />
        <ArrowHead id="af-w-muted" tone="muted" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* edges first so nodes render on top */}
      <path d="M144 69 H212" fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-teal-500" markerEnd="url(#af-w-teal)" />
      <path d="M98 90 C98 120 122 138 132 142" fill="none" strokeWidth={2} className="stroke-muted-foreground/60" markerEnd="url(#af-w-muted)" />
      <path d="M262 90 C262 118 240 136 230 141" fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-teal-500" markerEnd="url(#af-w-teal)" />
      <Box x={52} y={48} w={92} h={42} label="Frontend" />
      <Box x={216} y={48} w={92} h={42} label="API" />
      <ellipse cx={180} cy={146} rx={52} ry={24} strokeWidth={1.5} className={panelCls} />
      <text x={180} y={149} fontSize={8.5} textAnchor="middle" className="fill-foreground/80">Database</text>
      {/* tag pill — the real Tag element */}
      <rect x={56} y={30} width={30} height={12} rx={6} strokeWidth={1.1} className="fill-amber-500/15 stroke-amber-500" />
      <text x={71} y={38.5} fontSize={6.5} textAnchor="middle" className="fill-amber-600 dark:fill-amber-400">prod</text>
      <Grips x={52} y={48} w={92} h={42} />
      {/* sparkle accents + add badge */}
      <path d="M322 30 l2.4 7.4 7.4 2.4 -7.4 2.4 -2.4 7.4 -2.4 -7.4 -7.4 -2.4 7.4 -2.4 Z" className="fill-teal-500/40" />
      <path d="M300 58 l1.7 5.2 5.2 1.7 -5.2 1.7 -1.7 5.2 -1.7 -5.2 -5.2 -1.7 5.2 -1.7 Z" className="fill-teal-500/25" />
      <circle cx={308} cy={48} r={8} className="fill-teal-500" />
      <path d="M308 44.5 V51.5 M304.5 48 H311.5" strokeWidth={1.8} strokeLinecap="round" className="stroke-background" />
    </Frame>
  )
}

function WorkspaceFig() {
  return (
    <Frame
      height={280}
      label="The Atom Flow workspace: the real left tool rail with its fifteen buttons, canvas with two connected nodes, bottom style bar, corner controls and the lock button"
    >
      <rect x={5} y={5} width={350} height={270} rx={10} strokeWidth={1.5} className={canvasCls} />

      {/* left tool rail — the real 15 buttons in order */}
      <rect x={10} y={10} width={26} height={216} rx={6} strokeWidth={1.5} className={panelCls} />
      {RAIL_TOOLS.map((t, i) => (
        <Tile
          key={t.label}
          x={16.5}
          y={13 + i * 14}
          size={13}
          icon={t.icon}
          active={i === 1 /* Select is the default tool */}
        />
      ))}

      {/* top-left cluster: fullscreen / theme / background (real order) */}
      <Tile x={46} y={13} icon={Maximize2} />
      {/* theme tile — sun in light mode, moon in dark mode, like the real toggler */}
      <rect x={64} y={13} width={14} height={14} rx={3.6} strokeWidth={1.2} className="fill-card stroke-border" />
      <ThemeGlyph x={66.5} y={15.5} size={9} />
      {/* background tile — shows the Plain variant icon (Square) */}
      <Tile x={82} y={13} icon={Square} />
      <Lab x={46} y={36} anchor="start" size={6.5}>Fullscreen · Theme · Background</Lab>

      {/* top-right cluster: clear / import / export / help (real order) */}
      <Tile x={248} y={13} icon={Trash2} />
      <Tile x={268} y={13} icon={Upload} />
      <Tile x={288} y={13} icon={Download} />
      <Tile x={308} y={13} icon={CircleHelp} active />
      <Lab x={322} y={36} anchor="end" size={6.5}>Clear · Import · Export · Help</Lab>

      {/* canvas nodes + smart edge */}
      <path d="M166 138 C 188 138 188 176 210 176" fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-teal-500" />
      <Box x={90} y={120} w={76} h={36} label="Frontend" />
      <Box x={210} y={158} w={72} h={36} label="API" />
      <Grips x={90} y={120} w={76} h={36} />

      {/* bottom style bar — the real six panels */}
      <rect x={60} y={238} width={240} height={26} rx={8} strokeWidth={1.5} className={panelCls} />
      <BarBtn x={66} y={241} icon={Shapes} label="Shapes" />
      <BarBtn x={102} y={241} icon={PaintBucket} label="BG" />
      <BarBtn x={138} y={241} icon={BorderAll} label="Border" />
      <BarBtn x={174} y={241} textGlyph="T" />
      <BarBtn x={210} y={241} textGlyph="Aa" />
      <BarBtn x={246} y={241} icon={RotateCw} label="Rotate" />
      <Lab x={180} y={273} size={6.5}>Style bar</Lab>

      {/* lock button — bottom-left, below the rail */}
      <Tile x={16} y={244} size={14} icon={LockOpen} />
      <Lab x={23} y={273} anchor="middle" size={6.5}>Lock board</Lab>
    </Frame>
  )
}

function QuickMenuFig() {
  // Real radial menu: 6 items, 60° apart, starting at the top, radius 92 →
  // drawn here at radius 54. Order: Add shape, Select, Hand, Fit view,
  // Lock board, Fullscreen. Active tool (Select) glows teal.
  const cx = 180
  const cy = 102
  const r = 54
  const items: { icon: LucideIcon; label: string; lx: number; ly: number; anchor: "start" | "middle" | "end"; active?: boolean }[] = [
    { icon: Plus, label: "Add shape", lx: cx, ly: cy - r - 16, anchor: "middle" },
    { icon: MousePointer2, label: "Select", lx: cx + r + 16, ly: cy - r / 2 + 3, anchor: "start", active: true },
    { icon: Hand, label: "Hand", lx: cx + r + 16, ly: cy + r / 2 + 3, anchor: "start" },
    { icon: Scan, label: "Fit view", lx: cx, ly: cy + r + 22, anchor: "middle" },
    { icon: Lock, label: "Lock board", lx: cx - r - 16, ly: cy + r / 2 + 3, anchor: "end" },
    { icon: Maximize2, label: "Fullscreen", lx: cx - r - 16, ly: cy - r / 2 + 3, anchor: "end" },
  ]
  return (
    <Frame label="The radial quick menu with the real six actions — Add shape, Select, Hand, Fit view, Lock board and Fullscreen — fanned around a close hub">
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* dimmed board behind (the menu opens over a dark backdrop) */}
      <rect x={5} y={5} width={350} height={190} rx={10} className="fill-black/40" />
      <Box x={24} y={24} w={64} h={30} className="opacity-40" />
      <Box x={284} y={146} w={56} h={30} className="opacity-40" />
      {/* rotating dashed orbit + teal ripple (real radii scaled) */}
      <circle cx={cx} cy={cy} r={r} fill="none" strokeDasharray="4 4" className="stroke-foreground/25" />
      <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-teal-500/30" />
      {/* items at -90° + i·60°, clockwise from the top */}
      {items.map((it, i) => {
        const angle = ((-90 + i * 60) * Math.PI) / 180
        const ix = cx + Math.cos(angle) * r
        const iy = cy + Math.sin(angle) * r
        return (
          <g key={it.label}>
            {it.active && <circle cx={ix} cy={iy} r={14} className="fill-teal-500/20" />}
            <circle cx={ix} cy={iy} r={11} strokeWidth={1.5} className={cn("fill-popover stroke-border", it.active && "stroke-teal-500")} />
            <it.icon
              x={ix - 6}
              y={iy - 6}
              width={12}
              height={12}
              aria-hidden
              className={cn(it.active ? "text-teal-600 dark:text-teal-300" : "text-foreground/85")}
            />
            <Lab x={it.lx} y={it.ly} anchor={it.anchor} size={7} className="fill-foreground/90">
              {it.label}
            </Lab>
          </g>
        )
      })}
      {/* hub = close (real: ✕ in a popover circle) */}
      <circle cx={cx} cy={cy} r={13} strokeWidth={1.5} className={panelCls} />
      <path d={`M${cx - 4} ${cy - 4} L${cx + 4} ${cy + 4} M${cx + 4} ${cy - 4} L${cx - 4} ${cy + 4}`} strokeWidth={1.6} strokeLinecap="round" className="stroke-muted-foreground" />
      <Lab x={cx} y={186} size={7}>Tap the dark backdrop or the ✕ hub to close</Lab>
    </Frame>
  )
}

function AddElementsFig() {
  return (
    <Frame label="Click a tool in the rail — Rectangle shown active with a click ripple — and the element is added at once at the center of your view, already selected; every tool adds with a single click, no drawing needed">
      <defs>
        <ArrowHead id="af-ae-teal" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />

      {/* left tool rail — first 10 buttons, Rectangle active */}
      <rect x={10} y={10} width={26} height={150} rx={6} strokeWidth={1.5} className={panelCls} />
      {RAIL_TOOLS.slice(0, 10).map((t, i) => (
        <Tile key={t.label} x={16.5} y={14 + i * 14} size={13} icon={t.icon} active={i === 3 /* Rectangle */} />
      ))}
      <Lab x={42} y={20} anchor="start" size={7}>Left tool rail</Lab>

      {/* click ripple on the active Rectangle tile + cursor = "click once" */}
      <circle cx={23} cy={62.5} r={9.5} fill="none" strokeDasharray="3 3" strokeWidth={1.2} className="stroke-teal-500/70" />
      <Cursor x={23} y={62.5} />
      <Lab x={44} y={72} anchor="start" size={7}>Click a tool once</Lab>

      {/* arrow from the rail to the new element */}
      <path d="M46 42 C 90 42 120 62 148 80" fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-teal-500" markerEnd="url(#af-ae-teal)" />

      {/* new rectangle landing at the view center — selection grips show it is already selected */}
      <rect x={152} y={84} width={86} height={42} rx={6} strokeWidth={1.5} strokeDasharray="4 3" className="fill-teal-500/10 stroke-teal-500" />
      <Grips x={152} y={84} w={86} h={42} />
      <Lab x={195} y={140} size={7}>Added at the center of your view,</Lab>
      <Lab x={195} y={149} size={7}>already selected — drag it into place</Lab>

      {/* the other click-to-add tools: Line, Tag, Text, Table, Code behave the same */}
      <Tile x={228} y={158} size={13} icon={Minus} />
      <Tile x={246} y={158} size={13} icon={Tag} />
      <Tile x={264} y={158} size={13} icon={Type} />
      <Tile x={282} y={158} size={13} icon={Table2} />
      <Tile x={300} y={158} size={13} icon={FileCode} />
      <Lab x={271} y={182} size={7}>Line · Tag · Text · Table · Code —</Lab>
      <Lab x={271} y={191} size={7}>all added with one click too</Lab>
    </Frame>
  )
}

function IconsFig() {
  // Grid icons — a representative slice of the real library categories.
  const gridRow1 = [Database, Cloud, Globe, Server, Terminal]
  const gridRow2 = [Boxes, GitBranch, Layers, Braces, Shapes]
  return (
    <Frame
      height={220}
      label="The Add Icon dialog: search field, category chips, an icon grid, style options with their real icons, and a live preview of the Icon frame card"
    >
      <rect x={5} y={5} width={350} height={210} rx={10} strokeWidth={1.5} className={canvasCls} />

      {/* dialog card */}
      <rect x={18} y={14} width={186} height={192} rx={10} strokeWidth={1.5} className={panelCls} />
      <text x={30} y={29} fontSize={8.5} fontWeight={600} className="fill-foreground">Add Icon</text>

      {/* search */}
      <rect x={30} y={36} width={162} height={13} rx={4} strokeWidth={1.1} className="fill-background stroke-border" />
      <circle cx={38.5} cy={42.5} r={2.6} fill="none" strokeWidth={1.1} className="stroke-muted-foreground" />
      <path d="M40.5 44.5 L43 47" strokeWidth={1.1} strokeLinecap="round" className="stroke-muted-foreground" />
      <text x={48} y={45} fontSize={6.2} className="fill-muted-foreground">Search 1,900+ icons…</text>

      {/* category chips — real categories */}
      {[
        { t: "system", x: 30, active: true },
        { t: "aws", x: 66, active: false },
        { t: "database", x: 96, active: false },
        { t: "dev", x: 136, active: false },
        { t: "os", x: 160, active: false },
      ].map((c) => (
        <g key={c.t}>
          <rect
            x={c.x}
            y={56}
            width={c.t.length * 3.6 + 10}
            height={11}
            rx={5.5}
            strokeWidth={1}
            className={c.active ? "fill-teal-500/15 stroke-teal-500" : "fill-background stroke-border"}
          />
          <text
            x={c.x + (c.t.length * 3.6 + 10) / 2}
            y={63.8}
            fontSize={6}
            textAnchor="middle"
            className={c.active ? "fill-teal-600 dark:fill-teal-300" : "fill-muted-foreground"}
          >
            {c.t}
          </text>
        </g>
      ))}

      {/* icon grid 5×2 */}
      {[gridRow1, gridRow2].map((row, r) =>
        row.map((Icon, i) => (
          <g key={`${r}-${i}`}>
            <rect
              x={30 + i * 33}
              y={74 + r * 28}
              width={24}
              height={24}
              rx={4}
              strokeWidth={1.1}
              className={r === 0 && i === 0 ? "fill-teal-500/15 stroke-teal-500" : "fill-background stroke-border"}
            />
            <Icon
              x={30 + i * 33 + 5}
              y={74 + r * 28 + 5}
              width={14}
              height={14}
              aria-hidden
              className={r === 0 && i === 0 ? "text-teal-600 dark:text-teal-300" : "text-foreground/70"}
            />
          </g>
        )),
      )}

      {/* style options — the real three, with the icons the dialog uses */}
      <text x={30} y={142} fontSize={6.2} className="fill-muted-foreground">Style</text>
      <rect x={30} y={146} width={50} height={14} rx={4} strokeWidth={1.1} className="fill-background stroke-border" />
      <ImageIcon x={34} y={149.5} width={7} height={7} aria-hidden className="text-muted-foreground" />
      <text x={44} y={155.5} fontSize={5.8} className="fill-foreground/80">Icon only</text>
      <rect x={84} y={146} width={54} height={14} rx={4} strokeWidth={1.1} className="fill-background stroke-border" />
      <Type x={88} y={149.5} width={7} height={7} aria-hidden className="text-muted-foreground" />
      <text x={98} y={155.5} fontSize={5.8} className="fill-foreground/80">Icon + text</text>
      <rect x={142} y={146} width={50} height={14} rx={4} strokeWidth={1.1} className="fill-teal-500/15 stroke-teal-500" />
      <AppWindow x={146} y={149.5} width={7} height={7} aria-hidden className="text-teal-600 dark:text-teal-300" />
      <text x={156} y={155.5} fontSize={5.8} className="fill-teal-600 dark:fill-teal-300">Icon frame</text>

      {/* add button */}
      <rect x={30} y={170} width={162} height={16} rx={5} className="fill-teal-500" />
      <text x={111} y={181} fontSize={7.5} fontWeight={600} textAnchor="middle" className="fill-background">Add to board</text>

      {/* live preview — the real Icon frame: title top-left, icon top-right */}
      <Lab x={296} y={26} size={7}>Live preview</Lab>
      <rect x={244} y={34} width={104} height={78} rx={6} strokeWidth={1.5} className={panelCls} />
      <path d="M244 50 H348" strokeWidth={1.1} className="stroke-border" />
      <text x={250} y={45.5} fontSize={6.5} className="fill-foreground/85">Database</text>
      <Database x={320} y={56} width={22} height={22} aria-hidden className="text-foreground/70" />
      <Grips x={244} y={34} w={104} h={78} />
      {/* real frame size badge */}
      <rect x={266} y={122} width={60} height={14} rx={7} strokeWidth={1.1} className="fill-teal-500/10 stroke-teal-500" />
      <text x={296} y={131.8} fontSize={7} textAnchor="middle" className="fill-teal-600 dark:fill-teal-300">160 × 120</text>
      <Lab x={296} y={150} size={6.5}>Icon frame — app-window card</Lab>
      <Lab x={296} y={160} size={6.5}>Icon only &amp; Icon + text are 96 × 96</Lab>
      <Lab x={296} y={178} size={6.5}>Resize later by dragging the</Lab>
      <Lab x={296} y={187} size={6.5}>corner handles</Lab>
    </Frame>
  )
}

function ConnectFig() {
  return (
    <Frame label="A dashed connection line being dragged from a round handle on Frontend, bending around an obstacle box into Database">
      <defs>
        <ArrowHead id="af-cn-teal" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* obstacle */}
      <rect x={158} y={66} width={48} height={30} rx={4} strokeWidth={1.2} strokeDasharray="3 3" className="fill-muted/60 stroke-border" />
      <Lab x={182} y={84} size={6.5}>obstacle</Lab>
      {/* smart route under the obstacle */}
      <path d="M127 94 C 150 94 152 128 182 128 C 212 128 214 108 242 108" fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-teal-500" markerEnd="url(#af-cn-teal)" />
      <Box x={30} y={72} w={92} h={44} label="Frontend" />
      <Box x={242} y={86} w={88} h={44} label="Database" />
      {/* handles */}
      <circle cx={122} cy={84} r={2.6} className="fill-muted-foreground/60" />
      <circle cx={122} cy={104} r={2.6} className="fill-muted-foreground/60" />
      <circle cx={122} cy={94} r={9} fill="none" strokeWidth={1.2} className="stroke-teal-500/40" />
      <circle cx={122} cy={94} r={4.5} className="fill-teal-500" />
      <Cursor x={132} y={99} />
      <Lab x={146} y={90} anchor="start">Drag</Lab>
      <Lab x={242} y={78} anchor="start" size={7}>release here</Lab>
    </Frame>
  )
}

function StyleElementsFig() {
  // The real swatch palette used by BG / Border / Edge / Text color panels.
  const swatches = [
    { name: "Black", css: "#000000" },
    { name: "White", css: "#ffffff" },
    { name: "Green", css: "#10b981" },
    { name: "Red", css: "#ef4444" },
    { name: "Purple", css: "#a855f7" },
    { name: "Yellow", css: "#f59e0b" },
  ]
  return (
    <Frame label="A selected node with grips above the real bottom style bar — Shapes, BG, Border, T, Aa and Rotate buttons — with the BG panel open showing the six color swatches and the opacity slider">
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* selected node */}
      <rect x={24} y={40} width={130} height={60} rx={6} strokeWidth={1.5} className="fill-teal-500/10 stroke-teal-500" />
      <text x={89} y={73} fontSize={9} textAnchor="middle" className="fill-foreground/85">API gateway</text>
      <Grips x={24} y={40} w={130} h={60} />
      <path d="M89 102 V124" strokeDasharray="2 3" className="stroke-muted-foreground/40" />

      {/* style bar — primary row with the real buttons */}
      <rect x={14} y={126} width={332} height={60} rx={10} strokeWidth={1.5} className={panelCls} />
      <BarBtn x={24} y={134} w={48} icon={Shapes} label="Shapes" active />
      <BarBtn x={76} y={134} w={42} icon={PaintBucket} label="BG" />
      <BarBtn x={122} y={134} w={48} icon={BorderAll} label="Border" />
      <BarBtn x={174} y={134} w={26} textGlyph="T" />
      <BarBtn x={204} y={134} w={30} textGlyph="Aa" />
      <BarBtn x={238} y={134} w={50} icon={RotateCw} label="Rotate" />
      <Lab x={326} y={146} size={6} className="fill-muted-foreground/70">Edge panel appears</Lab>
      <Lab x={326} y={155} size={6} className="fill-muted-foreground/70">when a line is selected</Lab>

      {/* BG options row — no-color + the six real swatches + opacity slider */}
      <path d="M24 166 H336" strokeWidth={1} className="stroke-border" />
      {/* no color: transparent swatch with diagonal slash */}
      <rect x={30} y={172} width={10} height={10} rx={2} strokeWidth={1} className="fill-background stroke-border" />
      <path d="M30 182 L40 172" strokeWidth={1} className="stroke-border" />
      {swatches.map((s, i) => (
        <rect
          key={s.name}
          x={46 + i * 15}
          y={172}
          width={10}
          height={10}
          rx={2}
          strokeWidth={1}
          style={{ fill: s.css }}
          className="stroke-border"
        />
      ))}
      <Lab x={112} y={181} anchor="start" size={6.5}>six swatches</Lab>
      {/* opacity slider */}
      <text x={196} y={181} fontSize={6.5} className="fill-muted-foreground">Opacity</text>
      <path d="M228 177 H296" strokeWidth={1.4} strokeLinecap="round" className="stroke-border" />
      <circle cx={288} cy={177} r={3.2} className="fill-teal-500" />
      <text x={304} y={181} anchor="start" fontSize={6.5} className="fill-muted-foreground">100%</text>
      <Lab x={180} y={194} size={6.5}>BG panel open — every panel works on the selection</Lab>
    </Frame>
  )
}

function StyleConnectionsFig() {
  // Real edge panel controls: solid/dashed, the six swatches, 1–5px width, Animate On/Off.
  return (
    <Frame label="The Edge panel controls — style, color swatches, width and animate — with three sample connections: solid, dashed animated and thick red">
      <defs>
        <ArrowHead id="af-sc-muted" tone="muted" />
        <ArrowHead id="af-sc-teal" />
        <ArrowHead id="af-sc-red" tone="rose" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />

      {/* Edge panel replica (top) */}
      <rect x={30} y={14} width={300} height={26} rx={8} strokeWidth={1.5} className={panelCls} />
      <text x={42} y={30} fontSize={6.5} className="fill-muted-foreground">Style</text>
      <rect x={64} y={21} width={26} height={12} rx={3} strokeWidth={1} className="fill-teal-500/15 stroke-teal-500" />
      <text x={77} y={29.5} fontSize={6} textAnchor="middle" className="fill-teal-600 dark:fill-teal-300">solid</text>
      <rect x={94} y={21} width={30} height={12} rx={3} strokeWidth={1} className="fill-background stroke-border" />
      <text x={109} y={29.5} fontSize={6} textAnchor="middle" className="fill-foreground/70">dashed</text>
      <text x={136} y={30} fontSize={6.5} className="fill-muted-foreground">Color</text>
      {["#000000", "#ffffff", "#10b981", "#ef4444", "#a855f7", "#f59e0b"].map((c, i) => (
        <circle key={c} cx={166 + i * 11} cy={27} r={3.4} strokeWidth={0.8} style={{ fill: c }} className="stroke-border" />
      ))}
      <text x={238} y={30} fontSize={6.5} className="fill-muted-foreground">Width</text>
      <rect x={260} y={21} width={22} height={12} rx={3} strokeWidth={1} className="fill-background stroke-border" />
      <text x={271} y={29.5} fontSize={6} textAnchor="middle" className="fill-foreground/70">1–5px</text>
      <text x={290} y={30} fontSize={6.5} className="fill-muted-foreground">Animate</text>
      <rect x={314} y={21} width={12} height={12} rx={3} strokeWidth={1} className="fill-teal-500/15 stroke-teal-500" />

      {/* row 1 — solid */}
      <rect x={22} y={62} width={44} height={28} rx={5} strokeWidth={1.5} className={panelCls} />
      <rect x={294} y={62} width={44} height={28} rx={5} strokeWidth={1.5} className={panelCls} />
      <path d="M66 76 H290" fill="none" strokeWidth={2} className="stroke-foreground" markerEnd="url(#af-sc-muted)" />
      <Lab x={180} y={64}>Solid — plain direct link</Lab>

      {/* row 2 — dashed + animate */}
      <rect x={22} y={104} width={44} height={28} rx={5} strokeWidth={1.5} className={panelCls} />
      <rect x={294} y={104} width={44} height={28} rx={5} strokeWidth={1.5} className={panelCls} />
      <path d="M66 118 H290" fill="none" strokeWidth={2} strokeDasharray="6 5" className="stroke-teal-500" markerEnd="url(#af-sc-teal)" />
      <path d="M148 114 l5 4 -5 4 M160 114 l5 4 -5 4" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="stroke-teal-400/70" fill="none" />
      <Lab x={180} y={106}>Dashed + Animate — data is flowing</Lab>

      {/* row 3 — thick colored */}
      <rect x={22} y={148} width={44} height={28} rx={5} strokeWidth={1.5} className={panelCls} />
      <rect x={294} y={148} width={44} height={28} rx={5} strokeWidth={1.5} className={panelCls} />
      <path d="M66 162 H290" fill="none" strokeWidth={4} className="stroke-rose-500" markerEnd="url(#af-sc-red)" />
      <Lab x={180} y={150}>Width &amp; color — show importance</Lab>
    </Frame>
  )
}

function EditFig() {
  return (
    <Frame label="A dashed selection box around two elements with teal smart guides and move arrows; keyboard hints for copy and paste">
      <defs>
        <ArrowHead id="af-ed-muted" tone="muted" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* smart guides behind everything */}
      <path d="M150 26 V172 M78 70 H282" strokeDasharray="2 4" strokeWidth={1} className="stroke-teal-500/50" />
      {/* marquee + nodes */}
      <rect x={96} y={40} width={158} height={100} rx={4} strokeWidth={1.5} strokeDasharray="5 4" className="fill-teal-500/5 stroke-teal-500" />
      <Box x={108} y={52} w={84} h={36} label="Users" />
      <Box x={126} y={98} w={88} h={34} label="Orders" />
      <Cursor x={96} y={40} />
      {/* move arrows */}
      <path d="M248 90 H276" fill="none" strokeWidth={1.5} className="stroke-muted-foreground" markerStart="url(#af-ed-muted)" markerEnd="url(#af-ed-muted)" />
      {/* keyboard hint chips (annotations, not UI) */}
      <rect x={262} y={40} width={44} height={14} rx={4} strokeWidth={1.1} className="fill-background stroke-border" />
      <text x={284} y={49.8} fontSize={6.5} textAnchor="middle" className="fill-foreground/75">Ctrl + C</text>
      <rect x={262} y={60} width={44} height={14} rx={4} strokeWidth={1.1} className="fill-background stroke-border" />
      <text x={284} y={69.8} fontSize={6.5} textAnchor="middle" className="fill-foreground/75">Ctrl + V</text>
      <Lab x={284} y={86} size={6.5}>copies keep</Lab>
      <Lab x={284} y={95} size={6.5}>connections</Lab>
      <Lab x={180} y={190} size={7}>Teal smart guides keep things aligned</Lab>
    </Frame>
  )
}

function ViewFig() {
  return (
    <Frame label="The real view controls: fullscreen brackets with the Maximize button, Hand panning with pan arrows, the Zoom in / Zoom out / Fit view rail buttons, and the plain, grid, dots background cycle">
      <defs>
        <ArrowHead id="af-vw-muted" tone="muted" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* fullscreen corner brackets + real button */}
      <path d="M14 22 V14 H22 M338 14 H346 V22 M14 178 V186 H22 M346 178 V186 H338" strokeWidth={2} strokeLinecap="round" className="stroke-teal-500" fill="none" />
      <Tile x={40} y={16} icon={Maximize2} />
      <Lab x={53} y={44} size={7}>Fullscreen</Lab>

      {/* hand panning */}
      <path d="M150 95 H214" fill="none" strokeWidth={1.5} className="stroke-muted-foreground/50" markerStart="url(#af-vw-muted)" markerEnd="url(#af-vw-muted)" />
      <path d="M182 64 V126" fill="none" strokeWidth={1.5} className="stroke-muted-foreground/50" markerStart="url(#af-vw-muted)" markerEnd="url(#af-vw-muted)" />
      <Tile x={175} y={88} size={16} icon={Hand} />
      <Lab x={182} y={142} size={7}>Hand — drag to pan</Lab>

      {/* zoom / fit rail buttons (real icons) */}
      <Tile x={302} y={64} icon={ZoomIn} />
      <Tile x={302} y={84} icon={ZoomOut} />
      <Tile x={302} y={104} icon={Scan} />
      <Lab x={296} y={68} anchor="end" size={6.5}>Zoom in</Lab>
      <Lab x={296} y={88} anchor="end" size={6.5}>Zoom out</Lab>
      <Lab x={296} y={108} anchor="end" size={6.5}>Fit view</Lab>
      <Lab x={322} y={126} anchor="middle" size={6.5}>also scroll / pinch</Lab>

      {/* background cycle — the real three variants with their real icons */}
      <Lab x={64} y={162} size={7}>Background cycles:</Lab>
      <Tile x={40} y={168} icon={Square} />
      <Lab x={47} y={194} size={6.5}>Plain</Lab>
      <path d="M60 175 H72" strokeDasharray="2 2" className="stroke-muted-foreground/40" />
      <Tile x={78} y={168} icon={Grid3x3} />
      <Lab x={85} y={194} size={6.5}>Grid</Lab>
      <path d="M98 175 H110" strokeDasharray="2 2" className="stroke-muted-foreground/40" />
      <Tile x={116} y={168} icon={Grip} />
      <Lab x={123} y={194} size={6.5}>Dots</Lab>
    </Frame>
  )
}

function LockFig() {
  return (
    <Frame label="A locked board: dimmed elements, a padlock badge in the middle, a tapped element with a teal highlight ring, and the lock button showing its Locked badge">
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* dimmed nodes + edge */}
      <path d="M148 71 C170 71 182 90 212 91" fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-muted-foreground/60" opacity={0.6} />
      <Box x={60} y={52} w={88} h={38} label="Frontend" className="opacity-60" />
      <Box x={212} y={72} w={92} h={38} label="API" className="opacity-60" />
      {/* tapped highlight ring */}
      <rect x={206} y={66} width={104} height={50} rx={8} fill="none" strokeWidth={1.5} strokeDasharray="4 4" className="stroke-teal-500/60" />
      {/* lock badge */}
      <circle cx={180} cy={96} r={22} fill="none" strokeWidth={1.2} strokeDasharray="3 4" className="stroke-teal-500/50" />
      <circle cx={180} cy={96} r={13} strokeWidth={2} className="fill-card stroke-teal-500" />
      <path d="M177.5 96 V93.4 A2.6 2.6 0 0 1 182.7 93.4 V96" strokeWidth={1.6} className="stroke-teal-500" fill="none" />
      <rect x={175.5} y={96} width={9} height={7} rx={1.5} className="fill-teal-500" />
      {/* view-only pill */}
      <rect x={286} y={16} width={58} height={17} rx={8.5} strokeWidth={1.2} className="fill-teal-500/10 stroke-teal-500" />
      <text x={315} y={27.5} fontSize={7.5} textAnchor="middle" className="fill-teal-600 dark:fill-teal-300">View-only</text>
      {/* lock button (locked state: teal border, closed lock) + real Locked badge */}
      <Tile x={18} y={160} size={16} icon={Lock} active />
      <rect x={40} y={160} width={46} height={16} rx={4} strokeWidth={1.1} className="fill-teal-500/10 stroke-teal-500" />
      <text x={63} y={171} fontSize={7} fontWeight={600} letterSpacing={1} textAnchor="middle" className="fill-teal-600 dark:fill-teal-300">LOCKED</text>
      <Lab x={63} y={188} size={6.5}>click again to unlock</Lab>
    </Frame>
  )
}

function ImportExportFig() {
  return (
    <Frame
      height={210}
      label="The real Import and Export dialogs side by side: Import picks a .json file or pastes JSON; Export has a file name field and PNG, SVG and JSON format cards"
    >
      <rect x={5} y={5} width={350} height={200} rx={10} strokeWidth={1.5} className={canvasCls} />

      {/* Import dialog */}
      <rect x={18} y={18} width={150} height={174} rx={10} strokeWidth={1.5} className={panelCls} />
      <text x={30} y={33} fontSize={8} fontWeight={600} className="fill-foreground">Import diagram</text>
      {/* dropzone */}
      <rect x={30} y={42} width={126} height={42} rx={6} strokeWidth={1.2} strokeDasharray="4 3" className="fill-background stroke-border" />
      <Upload x={87} y={48} width={12} height={12} aria-hidden className="text-muted-foreground" />
      <text x={93} y={70} fontSize={6} textAnchor="middle" className="fill-foreground/75">Choose a .json file</text>
      <text x={93} y={79} fontSize={5.4} textAnchor="middle" className="fill-muted-foreground">or paste the JSON below</text>
      {/* paste area */}
      <rect x={30} y={92} width={126} height={40} rx={4} strokeWidth={1.1} className="fill-background stroke-border" />
      <text x={36} y={106} fontSize={6} fontFamily="monospace" className="fill-muted-foreground">{"{ \"nodes\": […],"}</text>
      <text x={36} y={116} fontSize={6} fontFamily="monospace" className="fill-muted-foreground">{"  \"edges\": […] }"}</text>
      {/* buttons */}
      <rect x={30} y={144} width={46} height={16} rx={5} strokeWidth={1.1} className="fill-background stroke-border" />
      <text x={53} y={155} fontSize={6.5} textAnchor="middle" className="fill-foreground/80">Cancel</text>
      <rect x={80} y={144} width={52} height={16} rx={5} className="fill-teal-500" />
      <text x={106} y={155} fontSize={6.5} fontWeight={600} textAnchor="middle" className="fill-background">Import</text>
      <Lab x={93} y={178} size={6.5}>rebuilds the whole board — undo still works</Lab>

      {/* Export dialog */}
      <rect x={192} y={18} width={150} height={174} rx={10} strokeWidth={1.5} className={panelCls} />
      <text x={204} y={33} fontSize={8} fontWeight={600} className="fill-foreground">Export diagram</text>
      {/* file name */}
      <text x={204} y={47} fontSize={6} className="fill-muted-foreground">File name</text>
      <rect x={204} y={51} width={126} height={13} rx={4} strokeWidth={1.1} className="fill-background stroke-border" />
      <text x={210} y={60.5} fontSize={6.2} className="fill-foreground/80">diagram</text>
      {/* format cards — real three, real icons */}
      <text x={204} y={78} fontSize={6} className="fill-muted-foreground">Format</text>
      {[
        { icon: ImageIcon, label: "PNG", hint: "Raster image", x: 204, active: true },
        { icon: FileCode, label: "SVG", hint: "Vector image", x: 248, active: false },
        { icon: Braces, label: "JSON", hint: "Editable project", x: 292, active: false },
      ].map((f) => (
        <g key={f.label}>
          <rect
            x={f.x}
            y={83}
            width={38}
            height={36}
            rx={5}
            strokeWidth={1.1}
            className={f.active ? "fill-teal-500/10 stroke-teal-500" : "fill-background stroke-border"}
          />
          <f.icon
            x={f.x + 14}
            y={87}
            width={10}
            height={10}
            aria-hidden
            className={f.active ? "text-teal-600 dark:text-teal-300" : "text-muted-foreground"}
          />
          <text
            x={f.x + 19}
            y={106}
            fontSize={6}
            fontWeight={600}
            textAnchor="middle"
            className={f.active ? "fill-teal-600 dark:fill-teal-300" : "fill-foreground/80"}
          >
            {f.label}
          </text>
          <text x={f.x + 19} y={113} fontSize={4.6} textAnchor="middle" className="fill-muted-foreground">
            {f.hint}
          </text>
        </g>
      ))}
      {/* export button */}
      <rect x={204} y={144} width={72} height={16} rx={5} className="fill-teal-500" />
      <text x={240} y={155} fontSize={6.5} fontWeight={600} textAnchor="middle" className="fill-background">Export PNG</text>
      <Lab x={267} y={178} size={6.5}>PNG · SVG · re-openable JSON project</Lab>
    </Frame>
  )
}

/* ---------------- dispatcher ---------------- */

export function GuideFigure({ id, className }: { id: GuideFigureId; className?: string }) {
  const fig = (() => {
    switch (id) {
      case "welcome":
        return <WelcomeFig />
      case "workspace":
        return <WorkspaceFig />
      case "quick-menu":
        return <QuickMenuFig />
      case "add-elements":
        return <AddElementsFig />
      case "icons":
        return <IconsFig />
      case "connect":
        return <ConnectFig />
      case "style-elements":
        return <StyleElementsFig />
      case "style-connections":
        return <StyleConnectionsFig />
      case "edit":
        return <EditFig />
      case "view":
        return <ViewFig />
      case "lock":
        return <LockFig />
      case "import-export":
        return <ImportExportFig />
    }
  })()
  return <div className={cn("[&_svg]:h-auto [&_svg]:w-full", className)}>{fig}</div>
}
