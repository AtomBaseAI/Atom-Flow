"use client"

import { useState } from "react"
import {
  Shapes,
  PaintBucket,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  FolderPlus as BorderAll,
  LucideArchive as BezierCurve,
  RotateCw,
} from "lucide-react"

type Props = {
  visible: boolean
  isNodeSelected: boolean
  isEdgeSelected: boolean
  onChangeShape: (type: "rectangle" | "ellipse" | "triangle" | "diamond" | "hexagon" | "text") => void
  onChangeBG: (color: string) => void

  onBorderStyle: (style: "solid" | "dashed") => void
  onBorderColor: (color: string) => void
  onBorderWidth: (w: number) => void

  onChangeTextSize: (size: number) => void
  onChangeTextColor: (color: string) => void
  onAlign: (align: "left" | "center" | "right") => void
  onBold: (bold: boolean) => void

  onEdgeStyle: (style: "solid" | "dashed") => void
  onEdgeColor: (color: string) => void
  onEdgeWidth: (w: number) => void
  onEdgeAnimate: (animate: boolean) => void

  onRotate: (deg: number) => void // added
}

export default function BottomToolbar({
  visible,
  isNodeSelected,
  isEdgeSelected,
  onChangeShape,
  onChangeBG,
  onBorderStyle,
  onBorderColor,
  onBorderWidth,
  onChangeTextSize,
  onChangeTextColor,
  onAlign,
  onBold,
  onEdgeStyle,
  onEdgeColor,
  onEdgeWidth,
  onEdgeAnimate,
  onRotate,
}: Props) {
  const [open, setOpen] = useState<null | "shapes" | "bg" | "border" | "textSize" | "typo" | "edge" | "rotate">(null) // added rotate
  const [deg, setDeg] = useState(0) // local display state for rotation

  const swatches = [
    { name: "Black", value: "#000000" },
    { name: "White", value: "#ffffff" },
    { name: "Green", value: "#10b981" },
    { name: "Red", value: "#ef4444" },
    { name: "Purple", value: "#a855f7" },
    { name: "Yellow", value: "#f59e0b" },
  ] as const

  if (!visible) return null

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-4 z-20 flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-black/70 p-3 shadow-xl backdrop-blur">
        {/* Primary row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Node buttons */}
          <button
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"
            onClick={() => setOpen(open === "shapes" ? null : "shapes")}
            disabled={!isNodeSelected}
            title="Shapes"
          >
            <span className="inline-flex items-center gap-1">
              <Shapes className="h-4 w-4 text-teal-400" /> Shapes
            </span>
          </button>

          <button
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"
            onClick={() => setOpen(open === "bg" ? null : "bg")}
            disabled={!isNodeSelected}
            title="Background"
          >
            <span className="inline-flex items-center gap-1">
              <PaintBucket className="h-4 w-4 text-teal-400" /> BG
            </span>
          </button>

          <button
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"
            onClick={() => setOpen(open === "border" ? null : "border")}
            disabled={!isNodeSelected}
            title="Border"
          >
            <span className="inline-flex items-center gap-1">
              <BorderAll className="h-4 w-4 text-teal-400" /> Border
            </span>
          </button>

          <button
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"
            onClick={() => setOpen(open === "textSize" ? null : "textSize")}
            disabled={!isNodeSelected}
            title="Text Size"
          >
            T
          </button>

          <button
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"
            onClick={() => setOpen(open === "typo" ? null : "typo")}
            disabled={!isNodeSelected}
            title="Typography"
          >
            Aa
          </button>

          {/* New: Rotate */}
          <button
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"
            onClick={() => setOpen(open === "rotate" ? null : "rotate")}
            disabled={!isNodeSelected}
            title="Rotate"
          >
            <span className="inline-flex items-center gap-1">
              <RotateCw className="h-4 w-4 text-teal-400" /> Rotate
            </span>
          </button>

          <button
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"
            onClick={() => setOpen(open === "edge" ? null : "edge")}
            disabled={!isEdgeSelected}
            title="Edge"
          >
            <span className="inline-flex items-center gap-1">
              <BezierCurve className="h-4 w-4 text-teal-400" /> Edge
            </span>
          </button>
        </div>

        {/* Options row - only active panel shows */}
        {open === "shapes" && isNodeSelected && (
          <div className="flex flex-wrap items-center gap-2">
            {(["rectangle", "ellipse", "triangle", "diamond", "hexagon"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onChangeShape(t)}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {open === "bg" && isNodeSelected && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-300">Background</span>
            <div className="flex items-center gap-2">
              {swatches.map((s) => (
                <button
                  key={s.value}
                  aria-label={`Set background ${s.name}`}
                  onClick={() => onChangeBG(s.value)}
                  className="h-6 w-6 rounded border border-zinc-700"
                  style={{ backgroundColor: s.value }}
                  title={s.name}
                />
              ))}
            </div>
          </div>
        )}

        {open === "border" && isNodeSelected && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-zinc-300">Style</span>
            <button
              onClick={() => onBorderStyle("solid")}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            >
              solid
            </button>
            <button
              onClick={() => onBorderStyle("dashed")}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            >
              dashed
            </button>

            <span className="ml-3 text-xs text-zinc-300">Color</span>
            <div className="flex items-center gap-2">
              {swatches.map((s) => (
                <button
                  key={s.value}
                  aria-label={`Set border ${s.name}`}
                  onClick={() => onBorderColor(s.value)}
                  className="h-6 w-6 rounded border border-zinc-700"
                  style={{ backgroundColor: s.value }}
                  title={s.name}
                />
              ))}
            </div>

            <span className="ml-3 text-xs text-zinc-300">Width</span>
            <select
              onChange={(e) => onBorderWidth(Number.parseInt(e.target.value, 10))}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              defaultValue={1}
            >
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>
                  {w}px
                </option>
              ))}
            </select>
          </div>
        )}

        {open === "textSize" && isNodeSelected && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-300">Size</span>
            <select
              onChange={(e) => onChangeTextSize(Number.parseInt(e.target.value, 10))}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              defaultValue={8}
            >
              {[8, 10, 12, 14, 16, 18, 20, 24, 28].map((s) => (
                <option key={s} value={s}>
                  {s}px
                </option>
              ))}
            </select>
          </div>
        )}

        {open === "typo" && isNodeSelected && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-300">Color</span>
            <div className="flex items-center gap-2">
              {swatches.map((s) => (
                <button
                  key={s.value}
                  aria-label={`Set text color ${s.name}`}
                  onClick={() => onChangeTextColor(s.value)}
                  className="h-6 w-6 rounded border border-zinc-700"
                  style={{ backgroundColor: s.value }}
                  title={s.name}
                />
              ))}
            </div>
            <button
              onClick={() => onBold(true)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              aria-label="Bold"
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              onClick={() => onBold(false)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              aria-label="Normal weight"
              title="Normal"
            >
              B-
            </button>
            <button
              onClick={() => onAlign("left")}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              title="Align left"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onAlign("center")}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              title="Align center"
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              onClick={() => onAlign("right")}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              title="Align right"
            >
              <AlignRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {open === "edge" && isEdgeSelected && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-zinc-300">Style</span>
            <button
              onClick={() => onEdgeStyle("solid")}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            >
              solid
            </button>
            <button
              onClick={() => onEdgeStyle("dashed")}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            >
              dashed
            </button>

            <span className="ml-3 text-xs text-zinc-300">Color</span>
            <div className="flex items-center gap-2">
              {swatches.map((s) => (
                <button
                  key={s.value}
                  aria-label={`Set line color ${s.name}`}
                  onClick={() => onEdgeColor(s.value)}
                  className="h-6 w-6 rounded border border-zinc-700"
                  style={{ backgroundColor: s.value }}
                  title={s.name}
                />
              ))}
            </div>

            <span className="ml-3 text-xs text-zinc-300">Width</span>
            <select
              onChange={(e) => onEdgeWidth(Number.parseInt(e.target.value, 10))}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              defaultValue={1}
            >
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>
                  {w}px
                </option>
              ))}
            </select>

            <span className="ml-3 text-xs text-zinc-300">Animate</span>
            <button
              onClick={() => onEdgeAnimate(true)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            >
              On
            </button>
            <button
              onClick={() => onEdgeAnimate(false)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            >
              Off
            </button>
          </div>
        )}

        {open === "rotate" && isNodeSelected && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-zinc-300">Angle</span>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={deg}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10)
                setDeg(v)
                onRotate(v)
              }}
              className="w-40"
              aria-label="Rotate angle"
              title={`${deg}°`}
            />
            <input
              type="number"
              min={0}
              max={360}
              value={deg}
              onChange={(e) => {
                const v = Math.max(0, Math.min(360, Number.parseInt(e.target.value || "0", 10)))
                setDeg(v)
                onRotate(v)
              }}
              className="w-16 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              aria-label="Rotate degrees"
            />
            <button
              onClick={() => {
                setDeg(0)
                onRotate(0)
              }}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              title="Reset rotation"
            >
              0°
            </button>
            {[15, 45, 90].map((inc) => (
              <button
                key={inc}
                onClick={() => {
                  const next = (deg + inc) % 360
                  setDeg(next)
                  onRotate(next)
                }}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                title={`Rotate +${inc}°`}
              >
                +{inc}°
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
