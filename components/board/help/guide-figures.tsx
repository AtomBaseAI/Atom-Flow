"use client"

/**
 * Hand-drawn SVG illustrations for the user guide — "screens" drawn as
 * vectors, never real screenshots. Every figure mirrors the actual Atom Flow
 * UI using theme tokens (card / border / muted-foreground) plus teal accents,
 * so the same drawing reads correctly in light AND dark mode.
 *
 * Figures are referenced from guide-content.ts via the `figure` block kind
 * and rendered by GuideFigure below.
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import type { GuideFigureId } from "./guide-content"

/* ---------------- shared building blocks ---------------- */

const panelCls = "fill-card stroke-border"
const canvasCls = "fill-background stroke-border"

/** Rounded 360×200 canvas every figure draws on. */
function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 360 200" role="img" aria-label={label} className="block h-auto w-full">
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

/* ---------------- figures ---------------- */

function WelcomeFig() {
  return (
    <Frame label="A small architecture diagram: Frontend and API boxes connected to a Database ellipse">
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
    <Frame label="The Atom Flow workspace: left tool rail, canvas with two connected nodes, bottom style bar, corner controls and the lock button">
      <defs>
        <ArrowHead id="af-ws-teal" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* left tool rail */}
      <rect x={11} y={11} width={28} height={150} rx={6} strokeWidth={1.5} className={panelCls} />
      {[20, 44, 68, 92, 116, 140].map((ty, i) => (
        <rect
          key={ty}
          x={18}
          y={ty}
          width={14}
          height={14}
          rx={3}
          strokeWidth={1.2}
          className={i === 0 ? "fill-teal-500/15 stroke-teal-500" : panelCls}
        />
      ))}
      {/* rail glyphs */}
      <path d="M25 23.5 V30.5 M21.5 27 H28.5" strokeWidth={1.5} strokeLinecap="round" className="stroke-teal-500" />
      <rect x={21.5} y={47.5} width={7} height={5} rx={1} strokeWidth={1.2} className="stroke-muted-foreground/70" fill="none" />
      <circle cx={25} cy={75} r={3.6} strokeWidth={1.2} className="stroke-muted-foreground/70" fill="none" />
      <text x={25} y={98.5} fontSize={8} fontWeight={600} textAnchor="middle" className="fill-muted-foreground/70">T</text>
      <circle cx={23.8} cy={121.8} r={3} strokeWidth={1.2} className="stroke-muted-foreground/70" fill="none" />
      <path d="M26 124.5 L28.6 127.1" strokeWidth={1.2} strokeLinecap="round" className="stroke-muted-foreground/70" />
      <path d="M29.5 147 H20.5 M23 144.5 L20.5 147 L23 149.5" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" className="stroke-muted-foreground/70" fill="none" />
      {/* top-left cluster: theme / background / fullscreen */}
      <rect x={52} y={14} width={14} height={14} rx={3} strokeWidth={1.2} className={panelCls} />
      <circle cx={59} cy={21} r={2.5} strokeWidth={1.1} className="stroke-muted-foreground/70" fill="none" />
      <rect x={72} y={14} width={14} height={14} rx={3} strokeWidth={1.2} className={panelCls} />
      <path d="M74.5 19.5 H83.5 M74.5 23 H83.5 M78 16.5 V26" strokeWidth={1} className="stroke-muted-foreground/70" />
      <rect x={92} y={14} width={14} height={14} rx={3} strokeWidth={1.2} className={panelCls} />
      {/* top-right cluster: clear / import / export / help */}
      <rect x={252} y={14} width={14} height={14} rx={3} strokeWidth={1.2} className={panelCls} />
      <path d="M255 17 H263 M256 18.5 H262 V23.5 H256 Z" strokeWidth={1.1} strokeLinejoin="round" className="stroke-muted-foreground/70" fill="none" />
      <rect x={272} y={14} width={14} height={14} rx={3} strokeWidth={1.2} className={panelCls} />
      <path d="M279 17.5 V22 M276.5 20 L279 22.5 L281.5 20 M275 24.5 H283" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="stroke-muted-foreground/70" fill="none" />
      <rect x={292} y={14} width={14} height={14} rx={3} strokeWidth={1.2} className={panelCls} />
      <path d="M299 23 V18.5 M296.5 21 L299 18.5 L301.5 21 M295 24.5 H303" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" className="stroke-muted-foreground/70" fill="none" />
      <rect x={312} y={14} width={14} height={14} rx={3} strokeWidth={1.2} className="fill-teal-500/15 stroke-teal-500" />
      <text x={319} y={24.5} fontSize={8} fontWeight={600} textAnchor="middle" className="fill-teal-600 dark:fill-teal-300">?</text>
      {/* labels with leader ticks */}
      <path d="M59 29.5 V36" strokeDasharray="2 2" className="stroke-muted-foreground/40" />
      <Lab x={52} y={42} anchor="start">Theme &amp; view</Lab>
      <path d="M319 29.5 V36" strokeDasharray="2 2" className="stroke-muted-foreground/40" />
      <Lab x={326} y={42} anchor="end">Clear · Import · Export · Help</Lab>
      {/* canvas nodes */}
      <path d="M216 106 C234 106 232 140 250 140" fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-teal-500" markerEnd="url(#af-ws-teal)" />
      <Box x={140} y={88} w={76} h={36} label="Frontend" />
      <Box x={250} y={122} w={72} h={36} label="API" />
      {/* bottom style bar */}
      <rect x={120} y={168} width={150} height={20} rx={6} strokeWidth={1.5} className={panelCls} />
      <rect x={128} y={173} width={10} height={10} rx={2} className="fill-teal-500" />
      <rect x={142} y={173} width={10} height={10} rx={2} className="fill-rose-500" />
      <rect x={156} y={173} width={10} height={10} rx={2} className="fill-amber-500" />
      <rect x={170} y={173} width={10} height={10} rx={2} className="fill-emerald-500" />
      <path d="M190 172 V184" className="stroke-border" />
      <Lab x={232} y={181}>Style bar</Lab>
      {/* lock button */}
      <rect x={14} y={170} width={22} height={22} rx={5} strokeWidth={1.5} className={panelCls} />
      <rect x={20.5} y={179} width={9} height={7} rx={1.5} strokeWidth={1.4} className="stroke-foreground/80" fill="none" />
      <path d="M22.5 179 V176.5 A2.5 2.5 0 0 1 27.5 176.5 V179" strokeWidth={1.4} className="stroke-foreground/80" fill="none" />
      <Lab x={42} y={184} anchor="start">Lock</Lab>
    </Frame>
  )
}

function QuickMenuFig() {
  return (
    <Frame label="The round radial quick menu with six actions fanned around a close hub, opened right at the tap point">
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* faint background nodes */}
      <Box x={24} y={28} w={64} h={30} className="opacity-50" />
      <Box x={284} y={140} w={56} h={30} className="opacity-50" />
      {/* orbit + ripple around the tap point */}
      <circle cx={176} cy={102} r={54} fill="none" strokeDasharray="4 4" className="stroke-muted-foreground/40" />
      <circle cx={176} cy={102} r={26} fill="none" strokeDasharray="3 3" className="stroke-teal-500/40" />
      {/* items */}
      <circle cx={176} cy={48} r={11} strokeWidth={1.5} className={panelCls} />
      <path d="M176 43 V53 M171 48 H181" strokeWidth={1.5} strokeLinecap="round" className="stroke-foreground/80" />
      <circle cx={223} cy={75} r={11} strokeWidth={1.5} className="fill-teal-500/10 stroke-teal-500" />
      <path d="M220.8 70.3 V78.9 L223.1 76.7 L224.5 79.9 L226.3 79.1 L224.9 75.9 H228.2 Z" className="fill-teal-500" />
      <circle cx={223} cy={129} r={11} strokeWidth={1.5} className={panelCls} />
      <rect x={219.5} y={125} width={8} height={7.5} rx={2.5} strokeWidth={1.4} className="stroke-foreground/80" fill="none" />
      <path d="M221.2 125 V122.5 M223.5 125 V121.8 M225.8 125 V122.5" strokeWidth={1.3} strokeLinecap="round" className="stroke-foreground/80" />
      <circle cx={176} cy={156} r={11} strokeWidth={1.5} className={panelCls} />
      <path d="M170.5 155.5 V152.5 H173.5 M178.5 152.5 H181.5 V155.5 M181.5 156.5 V159.5 H178.5 M173.5 159.5 H170.5 V156.5" strokeWidth={1.3} strokeLinejoin="round" className="stroke-foreground/80" fill="none" />
      <circle cx={129} cy={129} r={11} strokeWidth={1.5} className={panelCls} />
      <rect x={125} y={129} width={8} height={6.5} rx={1.5} strokeWidth={1.3} className="stroke-foreground/80" fill="none" />
      <path d="M127 129 V126.8 A2.2 2.2 0 0 1 131.4 126.8 V129" strokeWidth={1.3} className="stroke-foreground/80" fill="none" />
      <circle cx={129} cy={75} r={11} strokeWidth={1.5} className={panelCls} />
      <path d="M126.5 77.5 L131.5 72.5 M131.5 75.5 V72.5 H128.5 M126.5 74.5 V77.5 H129.5" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" className="stroke-foreground/80" fill="none" />
      {/* hub = close */}
      <circle cx={176} cy={102} r={15} strokeWidth={1.5} className={panelCls} />
      <path d="M171.5 97.5 L180.5 106.5 M180.5 97.5 L171.5 106.5" strokeWidth={1.6} strokeLinecap="round" className="stroke-muted-foreground" />
      <Lab x={176} y={31}>Add shape</Lab>
      <Lab x={176} y={181}>Fit view</Lab>
      <Lab x={244} y={75} anchor="start" size={7}>active tool glows</Lab>
    </Frame>
  )
}

function AddElementsFig() {
  return (
    <Frame label="The tool rail with shape tiles on the left, an arrow leading to a new ghost rectangle appearing on the canvas">
      <defs>
        <ArrowHead id="af-ae-teal" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      <Lab x={46} y={16}>Tools</Lab>
      {/* palette */}
      <rect x={12} y={20} width={68} height={152} rx={8} strokeWidth={1.5} className={panelCls} />
      {[
        [20, 30],
        [50, 30],
        [20, 62],
        [50, 62],
        [20, 94],
        [50, 94],
        [20, 126],
        [50, 126],
      ].map(([tx, ty], i) => (
        <rect
          key={i}
          x={tx}
          y={ty}
          width={24}
          height={24}
          rx={4}
          strokeWidth={1.2}
          className={i === 0 ? "fill-teal-500/15 stroke-teal-500" : "fill-background/60 stroke-border"}
        />
      ))}
      {/* palette glyphs */}
      <rect x={25} y={36} width={14} height={11} rx={2} strokeWidth={1.3} className="stroke-teal-500" fill="none" />
      <circle cx={62} cy={42} r={6.5} strokeWidth={1.3} className="stroke-muted-foreground/70" fill="none" />
      <path d="M26 80 L38 68" strokeWidth={1.3} strokeLinecap="round" className="stroke-muted-foreground/70" />
      <rect x={55} y={70} width={14} height={9} rx={4.5} strokeWidth={1.3} className="stroke-muted-foreground/70" fill="none" />
      <text x={32} y={101} fontSize={10} fontWeight={600} textAnchor="middle" className="fill-muted-foreground/70">T</text>
      <rect x={54} y={99} width={16} height={13} rx={1.5} strokeWidth={1.2} className="stroke-muted-foreground/70" fill="none" />
      <path d="M54 104.5 H70 M54 110 H70 M59.5 99 V112 M64.5 99 V112" strokeWidth={1} className="stroke-muted-foreground/70" />
      <path d="M29 133.5 L24.5 138 L29 142.5 M35 133.5 L39.5 138 L35 142.5 M33.4 131.5 L30.6 144.5" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" className="stroke-muted-foreground/70" fill="none" />
      <rect x={54} y={131} width={16} height={13} rx={2} strokeWidth={1.2} className="stroke-muted-foreground/70" fill="none" />
      <path d="M56 141 l4 -4 3 3 3.5 -4.5 3.5 5.5" strokeWidth={1.2} className="stroke-muted-foreground/70" fill="none" />
      <circle cx={66} cy={134.5} r={1.4} className="fill-amber-400" />
      {/* canvas + drag-to-draw crosshair */}
      <rect x={92} y={20} width={256} height={152} rx={8} strokeWidth={1.5} className={canvasCls} />
      <path d="M120 60 H130 M125 55 V65" strokeWidth={1.2} strokeLinecap="round" className="stroke-muted-foreground/60" />
      <circle cx={125} cy={60} r={3} fill="none" strokeWidth={1.2} className="stroke-muted-foreground/60" />
      <Lab x={138} y={58} anchor="start" size={7}>Drag to draw</Lab>
      {/* arrow from palette to ghost node */}
      <path d="M46 42 C 90 42 130 58 176 80" fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-teal-500" markerEnd="url(#af-ae-teal)" />
      {/* ghost node appearing */}
      <rect x={180} y={84} width={86} height={42} rx={6} strokeWidth={1.5} strokeDasharray="4 3" className="fill-teal-500/10 stroke-teal-500" />
      <circle cx={266} cy={84} r={8} className="fill-teal-500" />
      <path d="M266 80 V88 M262 84 H270" strokeWidth={1.8} strokeLinecap="round" className="stroke-background" />
    </Frame>
  )
}

function IconsFig() {
  return (
    <Frame label="An icon frame card with resize grips and a size badge, next to the three icon style options">
      <defs>
        <ArrowHead id="af-ic-muted" tone="muted" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* resize ladder */}
      <rect x={34} y={90} width={22} height={22} rx={3} strokeWidth={1.3} className={panelCls} />
      <path d="M58 99 H63" strokeWidth={1.3} className="stroke-muted-foreground/60" markerEnd="url(#af-ic-muted)" />
      <rect x={66} y={84} width={30} height={30} rx={3} strokeWidth={1.3} className={panelCls} />
      <Lab x={60} y={128} size={7}>Resize</Lab>
      {/* icon frame card */}
      <Lab x={172} y={30}>Icon frame — an app-window card</Lab>
      <rect x={110} y={36} width={124} height={116} rx={8} strokeWidth={1.5} className={panelCls} />
      <path d="M110 58 H234" strokeWidth={1.2} className="stroke-border" />
      <circle cx={119} cy={47} r={1.8} className="fill-muted-foreground/70" />
      <circle cx={127} cy={47} r={1.8} className="fill-muted-foreground/70" />
      <circle cx={135} cy={47} r={1.8} className="fill-muted-foreground/70" />
      <rect x={146} y={74} width={52} height={40} rx={4} strokeWidth={1.2} className="fill-background stroke-border" />
      <path d="M152 108 l11 -11 7 7 8 -9 11 13" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="stroke-teal-500" fill="none" />
      <circle cx={186} cy={82} r={3.5} className="fill-amber-400" />
      <Grips x={110} y={36} w={124} h={116} />
      {/* size badge */}
      <rect x={146} y={160} width={52} height={16} rx={8} strokeWidth={1.2} className="fill-teal-500/10 stroke-teal-500" />
      <text x={172} y={170.5} fontSize={7} textAnchor="middle" className="fill-teal-600 dark:fill-teal-300">160 × 160</text>
      {/* style chips */}
      <Lab x={300} y={48}>Style</Lab>
      <rect x={252} y={56} width={96} height={16} rx={8} strokeWidth={1.2} className={panelCls} />
      <text x={300} y={66.5} fontSize={7.5} textAnchor="middle" className="fill-foreground/70">Icon only</text>
      <rect x={252} y={80} width={96} height={16} rx={8} strokeWidth={1.2} className={panelCls} />
      <text x={300} y={90.5} fontSize={7.5} textAnchor="middle" className="fill-foreground/70">Icon + text</text>
      <rect x={252} y={104} width={96} height={16} rx={8} strokeWidth={1.2} className="fill-teal-500/10 stroke-teal-500" />
      <text x={300} y={114.5} fontSize={7.5} textAnchor="middle" className="fill-teal-600 dark:fill-teal-300">Icon frame</text>
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
  return (
    <Frame label="A selected node with grips above the bottom style bar showing shape swaps, color swatches, border styles, text size, typography and rotation">
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* selected node */}
      <rect x={24} y={44} width={130} height={66} rx={6} strokeWidth={1.5} className="fill-teal-500/10 stroke-teal-500" />
      <text x={89} y={80} fontSize={9} textAnchor="middle" className="fill-foreground/85">API gateway</text>
      <Grips x={24} y={44} w={130} h={66} />
      <path d="M89 112 V140" strokeDasharray="2 3" className="stroke-muted-foreground/40" />
      {/* style bar */}
      <rect x={18} y={144} width={324} height={42} rx={8} strokeWidth={1.5} className={panelCls} />
      <path d="M94 150 V180 M150 150 V180 M210 150 V180 M246 150 V180 M286 150 V180" className="stroke-border" />
      {/* shapes */}
      <rect x={26} y={160.5} width={10} height={8} rx={2} strokeWidth={1.2} className="stroke-muted-foreground/70" fill="none" />
      <ellipse cx={44} cy={164.5} rx={5} ry={4.5} strokeWidth={1.2} className="stroke-muted-foreground/70" fill="none" />
      <path d="M57 159.5 L62 169 H52 Z" strokeWidth={1.2} strokeLinejoin="round" className="stroke-muted-foreground/70" fill="none" />
      <path d="M70 158.5 L75 164.5 L70 170.5 L65 164.5 Z" strokeWidth={1.2} strokeLinejoin="round" className="stroke-muted-foreground/70" fill="none" />
      <path d="M83 158.5 l4.5 2.6 v5.8 l-4.5 2.6 l-4.5 -2.6 v-5.8 Z" strokeWidth={1.2} strokeLinejoin="round" className="stroke-muted-foreground/70" fill="none" />
      <Lab x={56} y={181} size={6.5}>Shapes</Lab>
      {/* BG swatches */}
      <rect x={100} y={158} width={9} height={9} rx={2} className="fill-teal-500" />
      <rect x={110} y={158} width={9} height={9} rx={2} className="fill-rose-500" />
      <rect x={120} y={158} width={9} height={9} rx={2} className="fill-amber-500" />
      <rect x={130} y={158} width={9} height={9} rx={2} className="fill-emerald-500" />
      <rect x={140} y={158} width={9} height={9} rx={2} strokeWidth={1} className="fill-background stroke-border" />
      <path d="M140 167 L149 158" strokeWidth={1} className="stroke-border" />
      <Lab x={124} y={181} size={6.5}>BG</Lab>
      {/* border samples */}
      <path d="M158 162 H184" strokeWidth={2} className="stroke-foreground" />
      <path d="M158 173 H184" strokeWidth={2} strokeDasharray="4 3" className="stroke-foreground" />
      <Lab x={172} y={181} size={6.5}>Border</Lab>
      {/* T + slider */}
      <text x={222} y={172} fontSize={13} fontWeight={700} textAnchor="middle" className="fill-foreground/80">T</text>
      <path d="M229 167 H241" strokeWidth={1.2} className="stroke-border" />
      <circle cx={235} cy={167} r={2.5} className="fill-teal-500" />
      <Lab x={228} y={181} size={6.5}>T</Lab>
      {/* Aa */}
      <text x={258} y={172} fontSize={11} fontWeight={700} textAnchor="middle" className="fill-foreground/80">Aa</text>
      <circle cx={272} cy={168} r={3} className="fill-rose-500" />
      <path d="M268 176 H278 M268 179.5 H274" strokeWidth={1.2} className="stroke-muted-foreground/70" />
      <Lab x={266} y={181} size={6.5}>Aa</Lab>
      {/* rotate */}
      <path d="M294 166 H334" strokeWidth={1.2} className="stroke-border" />
      <circle cx={314} cy={166} r={3.5} className="fill-teal-500" />
      <text x={314} y={181} fontSize={6.5} textAnchor="middle" className="fill-muted-foreground">45°</text>
    </Frame>
  )
}

function StyleConnectionsFig() {
  return (
    <Frame label="Three connection samples between node stubs: solid, dashed and animated, and a thick colored line">
      <defs>
        <ArrowHead id="af-sc-muted" tone="muted" />
        <ArrowHead id="af-sc-teal" />
        <ArrowHead id="af-sc-rose" tone="rose" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* row 1 — solid */}
      <rect x={22} y={28} width={44} height={32} rx={5} strokeWidth={1.5} className={panelCls} />
      <rect x={294} y={28} width={44} height={32} rx={5} strokeWidth={1.5} className={panelCls} />
      <path d="M66 44 H290" fill="none" strokeWidth={2} className="stroke-foreground" markerEnd="url(#af-sc-muted)" />
      <Lab x={180} y={30}>Solid — plain direct link</Lab>
      {/* row 2 — dashed + animate */}
      <rect x={22} y={84} width={44} height={32} rx={5} strokeWidth={1.5} className={panelCls} />
      <rect x={294} y={84} width={44} height={32} rx={5} strokeWidth={1.5} className={panelCls} />
      <path d="M66 100 H290" fill="none" strokeWidth={2} strokeDasharray="6 5" className="stroke-teal-500" markerEnd="url(#af-sc-teal)" />
      <path d="M148 96 l5 4 -5 4 M160 96 l5 4 -5 4" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="stroke-teal-400/70" fill="none" />
      <Lab x={180} y={86}>Dashed + Animate — data is flowing</Lab>
      {/* row 3 — thick colored */}
      <rect x={22} y={140} width={44} height={32} rx={5} strokeWidth={1.5} className={panelCls} />
      <rect x={294} y={140} width={44} height={32} rx={5} strokeWidth={1.5} className={panelCls} />
      <path d="M66 156 H290" fill="none" strokeWidth={4} className="stroke-rose-500" markerEnd="url(#af-sc-rose)" />
      <Lab x={180} y={142}>Width &amp; color — show importance</Lab>
    </Frame>
  )
}

function EditFig() {
  return (
    <Frame label="A dashed selection box around two elements with teal smart guides, a move arrow and duplicate and delete buttons">
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
      {/* action chips */}
      <circle cx={272} cy={52} r={9} strokeWidth={1.3} className={panelCls} />
      <rect x={267.8} y={48.2} width={6} height={6} rx={1} strokeWidth={1.1} className="stroke-muted-foreground/80" fill="none" />
      <rect x={270.4} y={50.8} width={6} height={6} rx={1} strokeWidth={1.1} className="fill-card stroke-muted-foreground/80" />
      <circle cx={272} cy={76} r={9} strokeWidth={1.3} className={panelCls} />
      <path d="M268.5 72.5 H275.5 M269.5 74 H274.5 V80 H269.5 Z" strokeWidth={1.1} strokeLinejoin="round" className="stroke-muted-foreground/80" fill="none" />
      <Lab x={180} y={190} size={7}>Teal smart guides keep things aligned</Lab>
    </Frame>
  )
}

function ViewFig() {
  return (
    <Frame label="Fullscreen corner brackets, a hand tool with pan arrows, a zoom pill, a fit view button and background pattern swatches">
      <defs>
        <ArrowHead id="af-vw-muted" tone="muted" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* fullscreen corner brackets */}
      <path d="M14 22 V14 H22 M338 14 H346 V22 M14 178 V186 H22 M346 178 V186 H338" strokeWidth={2} strokeLinecap="round" className="stroke-teal-500" fill="none" />
      {/* pan cross with hand */}
      <path d="M160 91 H220" fill="none" strokeWidth={1.5} className="stroke-muted-foreground/50" markerStart="url(#af-vw-muted)" markerEnd="url(#af-vw-muted)" />
      <path d="M190 62 V118" fill="none" strokeWidth={1.5} className="stroke-muted-foreground/50" markerStart="url(#af-vw-muted)" markerEnd="url(#af-vw-muted)" />
      <rect x={183} y={84} width={14} height={13} rx={4} strokeWidth={1.4} className="fill-card stroke-foreground/80" />
      <path d="M186.5 84 V80.5 M190.5 84 V79.5 M194.5 84 V81 M183 90 l-4 2.5" strokeWidth={1.3} strokeLinecap="round" className="stroke-foreground/80" fill="none" />
      {/* zoom pill */}
      <rect x={24} y={148} width={112} height={28} rx={14} strokeWidth={1.5} className={panelCls} />
      <text x={44} y={166} fontSize={12} textAnchor="middle" className="fill-foreground/80">−</text>
      <path d="M60 154 V170 M100 154 V170" className="stroke-border" />
      <text x={80} y={165.5} fontSize={9} textAnchor="middle" className="fill-foreground/80">100%</text>
      <text x={117} y={166} fontSize={12} textAnchor="middle" className="fill-foreground/80">+</text>
      <Lab x={80} y={142}>Zoom</Lab>
      {/* fit view */}
      <rect x={24} y={112} width={28} height={28} rx={6} strokeWidth={1.5} className={panelCls} />
      <path d="M31 121.5 V118.5 H34 M42 118.5 H45 V121.5 M45 130.5 V133.5 H42 M34 133.5 H31 V130.5" strokeWidth={1.3} strokeLinejoin="round" className="stroke-foreground/80" fill="none" />
      <Lab x={58} y={127} anchor="start">Fit view</Lab>
      {/* background swatches */}
      <rect x={294} y={26} width={14} height={14} rx={3} strokeWidth={1.2} className={panelCls} />
      <rect x={314} y={26} width={14} height={14} rx={3} strokeWidth={1.2} className={panelCls} />
      <path d="M316.5 31.5 H325.5 M316.5 35.5 H325.5 M319 29 V38 M323.5 29 V38" strokeWidth={0.9} className="stroke-muted-foreground/70" />
      <rect x={334} y={26} width={14} height={14} rx={3} strokeWidth={1.2} className={panelCls} />
      <circle cx={338.5} cy={30.5} r={1} className="fill-muted-foreground/70" />
      <circle cx={343.5} cy={30.5} r={1} className="fill-muted-foreground/70" />
      <circle cx={338.5} cy={35.5} r={1} className="fill-muted-foreground/70" />
      <circle cx={343.5} cy={35.5} r={1} className="fill-muted-foreground/70" />
      <Lab x={321} y={54}>Background</Lab>
    </Frame>
  )
}

function LockFig() {
  return (
    <Frame label="A locked board: dimmed elements, a padlock badge in the middle, a tapped element with a teal highlight ring and the lock button with a cursor">
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
      {/* lock button + click */}
      <rect x={18} y={160} width={22} height={22} rx={5} strokeWidth={1.5} className={panelCls} />
      <rect x={23.5} y={171} width={9} height={7} rx={1.5} strokeWidth={1.4} className="stroke-foreground/80" fill="none" />
      <path d="M25.5 171 V168.4 A2.6 2.6 0 0 1 30.7 168.4 V169.6" strokeWidth={1.4} className="stroke-foreground/80" fill="none" />
      <Cursor x={48} y={168} />
      <path d="M54 162 l2 -2 M56 168 h3 M54 174 l2 2" strokeWidth={1.4} strokeLinecap="round" className="stroke-teal-500" />
      <Lab x={29} y={192} size={7}>Lock</Lab>
    </Frame>
  )
}

function ImportExportFig() {
  return (
    <Frame label="A JSON project file flowing into the board and PNG and SVG image files flowing out">
      <defs>
        <ArrowHead id="af-ie-teal" />
      </defs>
      <rect x={5} y={5} width={350} height={190} rx={10} strokeWidth={1.5} className={canvasCls} />
      {/* JSON card */}
      <rect x={18} y={56} width={84} height={88} rx={8} strokeWidth={1.5} className={panelCls} />
      <path d="M88 56 L102 70 H88 Z" strokeWidth={1.2} strokeLinejoin="round" className="fill-muted stroke-border" />
      <text x={56} y={104} fontSize={18} textAnchor="middle" className="fill-muted-foreground/80 font-mono">{"{ }"}</text>
      <Lab x={60} y={132} size={7}>project.json</Lab>
      {/* board mini */}
      <rect x={138} y={72} width={84} height={56} rx={8} strokeWidth={1.5} className={canvasCls} />
      <rect x={146} y={84} width={26} height={16} rx={3} strokeWidth={1.2} className="fill-teal-500/15 stroke-teal-500" />
      <rect x={188} y={96} width={26} height={16} rx={3} strokeWidth={1.2} className={panelCls} />
      <path d="M172 92 C180 92 180 104 188 104" fill="none" strokeWidth={1.5} strokeDasharray="3 3" className="stroke-teal-500" />
      {/* PNG card */}
      <rect x={258} y={42} width={84} height={48} rx={8} strokeWidth={1.5} className={panelCls} />
      <rect x={266} y={52} width={20} height={16} rx={2} strokeWidth={1.2} className="stroke-muted-foreground/70" fill="none" />
      <path d="M268 65 l6 -6 4 4 5 -6 6 8" strokeWidth={1.2} strokeLinejoin="round" className="stroke-muted-foreground/70" fill="none" />
      <circle cx={281} cy={55.5} r={1.6} className="fill-amber-400" />
      <Lab x={300} y={82}>PNG image</Lab>
      {/* SVG card */}
      <rect x={258} y={106} width={84} height={48} rx={8} strokeWidth={1.5} className={panelCls} />
      <path d="M266 138 C270 122 280 122 286 134" fill="none" strokeWidth={1.5} className="stroke-teal-500" />
      <rect x={264} y={136} width={4} height={4} className="fill-teal-500" />
      <rect x={284} y={132} width={4} height={4} className="fill-teal-500" />
      <Lab x={300} y={146}>SVG vector</Lab>
      {/* flow arrows */}
      <path d="M102 100 C116 100 122 100 136 100" fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-teal-500" markerEnd="url(#af-ie-teal)" />
      <Lab x={119} y={90} size={7}>Import</Lab>
      <path d="M222 86 C240 86 242 66 256 66" fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-teal-500" markerEnd="url(#af-ie-teal)" />
      <path d="M222 114 C240 114 242 130 256 130" fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-teal-500" markerEnd="url(#af-ie-teal)" />
      <Lab x={241} y={103} size={7}>Export</Lab>
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
