"use client"

import React from "react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import {
  MousePointer2,
  Square,
  Circle,
  Type,
  Hand,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  TagIcon,
  Plus,
  Minus,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ICON_CATEGORIES, ICONS } from "@/lib/icons-manifest"
import { cn } from "@/lib/utils"

type Props = {
  active: "select" | "rect" | "ellipse" | "text" | "hand"
  onChangeTool: (t: Props["active"]) => void
  onQuickAdd?: (t: "rect" | "ellipse" | "text" | "line") => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onOpenExport?: () => void // add export trigger
  onAddIcon?: (opts: { src: string; label: string }) => void
  onAddTag?: () => void // allow adding tag nodes
}

function ToolBtn({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean
  onClick?: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          onClick={onClick}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200",
            "hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-teal-500",
            active && "border-teal-500 text-white",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" align="center" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export default function LeftToolbar({
  active,
  onChangeTool,
  onQuickAdd,
  onZoomIn,
  onZoomOut,
  onOpenExport,
  onAddIcon,
  onAddTag,
}: Props) {
  const [iconOpen, setIconOpen] = React.useState(false)
  const [category, setCategory] = React.useState<(typeof ICON_CATEGORIES)[number]>("all")
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<{ cat: string; name: string } | null>(null)
  const [bottomText, setBottomText] = React.useState("")

  const allItems = React.useMemo(() => {
    const entries = Object.entries(ICONS).flatMap(([cat, arr]) => arr.map((name) => ({ cat, name })))
    return entries
  }, [])
  const items = React.useMemo(() => {
    let list = category === "all" ? allItems : allItems.filter((i) => i.cat === category)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((i) => i.name.toLowerCase().includes(q))
    }
    return list
  }, [allItems, category, search])

  const selectedSrc = selected ? `/vectors/${selected.cat}/${selected.name}.svg` : ""

  return (
    <TooltipProvider>
      {" "}
      {/* Wrap the entire component in TooltipProvider */}
      <div className="pointer-events-auto absolute left-4 top-1/2 z-20 -translate-y-1/2">
        <div className="flex w-10 flex-col items-center gap-1">
          <ToolBtn onClick={() => setIconOpen(true)} label="Add Icon">
            <Plus className="h-4 w-4" />
          </ToolBtn>

          {/* 1. Selection */}
          <ToolBtn active={active === "select"} onClick={() => onChangeTool("select")} label="Select">
            <MousePointer2 className="h-4 w-4" />
          </ToolBtn>

          {/* 2. Square */}
          <ToolBtn
            active={active === "rect"}
            onClick={() => (onQuickAdd ? onQuickAdd("rect") : onChangeTool("rect"))}
            label="Rectangle"
          >
            <Square className="h-4 w-4" />
          </ToolBtn>

          {/* 3. Ellipse */}
          <ToolBtn
            active={active === "ellipse"}
            onClick={() => (onQuickAdd ? onQuickAdd("ellipse") : onChangeTool("ellipse"))}
            label="Ellipse"
          >
            <Circle className="h-4 w-4" />
          </ToolBtn>

          {/* 4. Line */}
          <ToolBtn onClick={() => (onQuickAdd ? onQuickAdd("line") : onChangeTool("select"))} label="Line">
            <Minus className="h-4 w-4" />
          </ToolBtn>

          {/* spacer */}
          <div className="h-1" aria-hidden />

          {/* Tag */}
          <ToolBtn onClick={onAddTag} label="Tag">
            <TagIcon className="h-4 w-4" />
          </ToolBtn>

          {/* 7. Text */}
          <ToolBtn
            active={active === "text"}
            onClick={() => (onQuickAdd ? onQuickAdd("text") : onChangeTool("text"))}
            label="Text"
          >
            <Type className="h-4 w-4" />
          </ToolBtn>

          {/* spacer */}
          <div className="h-1" aria-hidden />

          {/* Hand (pan) */}
          <ToolBtn active={active === "hand"} onClick={() => onChangeTool("hand")} label="Hand">
            <Hand className="h-4 w-4" />
          </ToolBtn>

          {/* Zoom controls */}
          <ToolBtn onClick={onZoomIn} label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={onZoomOut} label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </ToolBtn>

          {/* Undo / Redo */}
          <ToolBtn
            onClick={() => {
              if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("board:undo"))
            }}
            label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            onClick={() => {
              if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("board:redo"))
            }}
            label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </ToolBtn>
        </div>

        {/* Dialog replacement */}
        {iconOpen && (
          <Dialog open={iconOpen} onOpenChange={setIconOpen}>
            <DialogContent
              className={cn(
                "border-zinc-800 bg-zinc-900 text-zinc-100",
                // Centering and sizing fixes
                "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                "w-[94vw] max-w-2xl md:max-w-3xl", // wider so grid doesn't collapse
                "p-4 rounded-lg shadow-xl",
              )}
            >
              <DialogHeader>
                <DialogTitle className="text-white text-sm">Add Icon</DialogTitle>
                <DialogDescription className="sr-only">
                  Choose an icon, optionally filter by folder, and set bottom text
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 w-full">
                {/* Search + category badges */}
                <div className="space-y-2">
                  <label className="block text-xs text-zinc-300" htmlFor="icon-search">
                    Search icons
                  </label>
                  <input
                    id="icon-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Search by name (e.g., aws, angular, ec2)"
                  />
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {ICON_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setCategory(cat)
                          setSelected(null)
                        }}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs border",
                          category === cat
                            ? "border-teal-600 bg-teal-600 text-white"
                            : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800",
                        )}
                        aria-pressed={category === cat}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected preview */}
                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded bg-zinc-200">
                      {selected ? (
                        <img
                          src={selected ? `/vectors/${selected.cat}/${selected.name}.svg` : "/placeholder.svg"}
                          alt={selected ? `${selected.name} preview` : "Icon preview"}
                          className="max-h-14 max-w-14 object-contain"
                          draggable={false}
                        />
                      ) : (
                        <span className="text-xs text-zinc-400">Preview</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm text-white">{selected ? selected.name : "No icon selected"}</div>
                      <div className="text-xs text-zinc-400">{selected ? selected.cat : "Choose an icon"}</div>
                    </div>
                  </div>
                </div>

                {/* Results grid - widen and keep stable height */}
                <div className="max-h-64 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-2">
                  {items.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-400">No icons found</div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                      {items.map((it) => {
                        const src = `/vectors/${it.cat}/${it.name}.svg`
                        const isSel = selected?.cat === it.cat && selected?.name === it.name
                        return (
                          <button
                            key={`${it.cat}-${it.name}`}
                            onClick={() => setSelected({ cat: it.cat, name: it.name })}
                            className={cn(
                              "flex aspect-square items-center justify-center rounded border p-1",
                              isSel ? "border-teal-600 bg-teal-950/40" : "border-zinc-800 bg-zinc-200 hover:bg-white",
                            )}
                            title={it.name}
                            aria-pressed={isSel}
                          >
                            <img
                              src={src || "/placeholder.svg"}
                              alt={it.name}
                              className="max-h-full max-w-full object-contain"
                              draggable={false}
                            />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Bottom text */}
                <div className="space-y-2">
                  <label className="block text-xs text-zinc-300" htmlFor="icon-text">
                    Bottom text
                  </label>
                  <input
                    id="icon-text"
                    value={bottomText}
                    onChange={(e) => setBottomText(e.target.value)}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g., AWS Lambda"
                  />
                </div>
              </div>

              <DialogFooter className="mt-2">
                <button
                  onClick={() => setIconOpen(false)}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  disabled={!selected}
                  onClick={() => {
                    if (!selected) return
                    const src = `/vectors/${selected.cat}/${selected.name}.svg`
                    onAddIcon?.({ src, label: bottomText })
                    setIconOpen(false)
                    setBottomText("")
                    setSearch("")
                    setSelected(null)
                    setCategory("all")
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs",
                    selected ? "border-teal-600 bg-teal-600 text-white" : "border-zinc-800 bg-zinc-900 text-zinc-400",
                  )}
                >
                  Add
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  )
}
