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
  Scan,
  Undo2,
  Redo2,
  TagIcon,
  Plus,
  Minus,
  Loader2,
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
import { loadLucideRegistry, type LucideEntry, type LucideRegistry } from "@/lib/lucide-icon-registry"
import { cn } from "@/lib/utils"

type Props = {
  active: "select" | "rect" | "ellipse" | "text" | "hand"
  onChangeTool: (t: Props["active"]) => void
  onQuickAdd?: (t: "rect" | "ellipse" | "text" | "line") => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitView?: () => void
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
            "flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground",
            "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-teal-500",
            active && "border-teal-500 text-teal-600 dark:text-white",
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

function LucideTile({
  entry,
  selected,
  onSelect,
}: {
  entry: LucideEntry
  selected: boolean
  onSelect: () => void
}) {
  const IconComp = entry.comp
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex aspect-square items-center justify-center rounded border p-1.5 transition-colors",
        selected
          ? "border-teal-600 bg-teal-500/10 text-teal-700 dark:text-white ring-1 ring-teal-600"
          : "border-border bg-muted text-foreground hover:bg-accent",
      )}
      title={entry.name + (entry.experimental ? " (experimental)" : "")}
      aria-pressed={selected}
      aria-label={`Select ${entry.name} icon`}
    >
      <IconComp className="h-5 w-5" strokeWidth={1.75} aria-hidden />
    </button>
  )
}

export default function LeftToolbar({
  active,
  onChangeTool,
  onQuickAdd,
  onZoomIn,
  onZoomOut,
  onFitView,
  onOpenExport,
  onAddIcon,
  onAddTag,
}: Props) {
  const [iconOpen, setIconOpen] = React.useState(false)
  const [category, setCategory] = React.useState<(typeof ICON_CATEGORIES)[number]>("all")
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<{ cat: string; name: string } | null>(null)
  const [bottomText, setBottomText] = React.useState("")

  // Lucide "system" group state
  const [systemSub, setSystemSub] = React.useState<string>("all")
  const [lucideReg, setLucideReg] = React.useState<LucideRegistry | null>(null)
  const [regLoading, setRegLoading] = React.useState(false)
  const regRequestedRef = React.useRef(false)

  const ensureRegistry = React.useCallback(() => {
    if (regRequestedRef.current) return
    regRequestedRef.current = true
    setRegLoading(true)
    loadLucideRegistry()
      .then((reg) => setLucideReg(reg))
      .catch(() => {})
      .finally(() => setRegLoading(false))
  }, [])

  React.useEffect(() => {
    if (iconOpen && category === "system") ensureRegistry()
  }, [iconOpen, category, ensureRegistry])

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

  const isSystem = category === "system"

  const systemGroups = React.useMemo(() => {
    if (!lucideReg) return []
    const q = search.trim().toLowerCase()
    if (!q) {
      if (systemSub === "all") return lucideReg.groups
      return lucideReg.groups.filter((g) => g.slug === systemSub)
    }
    // Searching inside the system group spans every sub-group
    return lucideReg.groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter(
          (e) =>
            e.name.includes(q) ||
            e.tags.some((t) => t.toLowerCase().includes(q)) ||
            e.aliases.some((a) => a.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.entries.length > 0)
  }, [lucideReg, systemSub, search])

  const selectedLucide = selected?.cat === "system" ? (lucideReg?.byName.get(selected.name) ?? null) : null
  const selectedSrc = selected
    ? selected.cat === "system"
      ? `lucide:${selected.name}`
      : `/vectors/${selected.cat}/${selected.name}.svg`
    : ""

  return (
    <TooltipProvider>
      {" "}
      {/* Wrap the entire component in TooltipProvider */}
      <div className="pointer-events-auto absolute bottom-20 left-4 top-14 z-20 flex flex-col">
        <div className="icon-picker-scroll my-auto flex max-h-full w-10 flex-col items-center gap-1 overflow-y-auto py-1">
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
          <ToolBtn onClick={onFitView} label="Fit view">
            <Scan className="h-4 w-4" />
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
                "border-border bg-card text-foreground",
                // Centering, sizing and viewport-fit fixes
                "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                "max-h-[90vh] w-[94vw] max-w-2xl overflow-y-auto md:max-w-4xl", // wider so grid doesn't collapse
                "p-4 rounded-lg shadow-xl",
              )}
            >
              <DialogHeader>
                <DialogTitle className="text-foreground text-sm">Add Icon</DialogTitle>
                <DialogDescription className="sr-only">
                  Choose an icon, optionally filter by folder, and set bottom text
                </DialogDescription>
              </DialogHeader>

              <div className="min-w-0 space-y-3 w-full">
                {/* Search + category badges */}
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground" htmlFor="icon-search">
                    Search icons
                  </label>
                  <input
                    id="icon-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder={isSystem ? "Search by name or tag (e.g., house, arrow, cloud)" : "Search by name (e.g., aws, angular, ec2)"}
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
                            : "border-border bg-card text-foreground hover:bg-accent",
                        )}
                        aria-pressed={category === cat}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* System sub-groups (lucide categories) */}
                  {isSystem && lucideReg && (
                    <div className="max-h-20 overflow-y-auto rounded-md border border-border bg-background p-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setSystemSub("all")}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px]",
                            systemSub === "all"
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-border bg-card text-muted-foreground hover:bg-accent",
                          )}
                          aria-pressed={systemSub === "all"}
                        >
                          all ({lucideReg.total})
                        </button>
                        {lucideReg.groups.map((g) => (
                          <button
                            key={g.slug}
                            onClick={() => setSystemSub(g.slug)}
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px]",
                              systemSub === g.slug
                                ? "border-teal-600 bg-teal-600 text-white"
                                : "border-border bg-card text-muted-foreground hover:bg-accent",
                            )}
                            aria-pressed={systemSub === g.slug}
                          >
                            {g.title.toLowerCase()} ({g.entries.length})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected preview */}
                <div className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
                      {selected ? (
                        selectedLucide ? (
                          <selectedLucide.comp className="h-10 w-10 text-foreground" aria-hidden />
                        ) : selected.cat === "system" ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                        ) : (
                          <img
                            src={selectedSrc || "/placeholder.svg"}
                            alt={`${selected.name} preview`}
                            className="max-h-14 max-w-14 object-contain"
                            draggable={false}
                          />
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">Preview</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm text-foreground">
                        {selected ? (selectedLucide?.experimental ? `${selected.name} (experimental)` : selected.name) : "No icon selected"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selected ? (selected.cat === "system" ? `system / lucide${selectedLucide ? "" : " (loading)"}` : selected.cat) : "Choose an icon"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Results grid - widen and keep stable height */}
                <div className="max-h-[420px] min-h-[240px] overflow-x-hidden overflow-y-auto rounded-md border border-border bg-background p-2 icon-picker-scroll">
                  {isSystem ? (
                    regLoading && !lucideReg ? (
                      <div className="flex h-48 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        Loading system icons…
                      </div>
                    ) : !lucideReg ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">Could not load system icons</div>
                    ) : systemGroups.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">No icons found</div>
                    ) : (
                      <div className="space-y-4">
                        {systemGroups.map((g) => (
                          <section
                            key={g.slug}
                            data-group={g.slug}
                            style={{
                              contentVisibility: "auto",
                              containIntrinsicSize: `auto 832px auto ${Math.ceil(g.entries.length / 10) * 60 + 34}px`,
                            } as React.CSSProperties}
                          >
                            <header className="flex items-center justify-between px-1 pb-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {g.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70">{g.entries.length}</span>
                            </header>
                            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
                              {g.entries.map((e) => (
                                <LucideTile
                                  key={`${g.slug}-${e.name}`}
                                  entry={e}
                                  selected={selected?.cat === "system" && selected?.name === e.name}
                                  onSelect={() => setSelected({ cat: "system", name: e.name })}
                                />
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    )
                  ) : items.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">No icons found</div>
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
                              isSel ? "border-teal-600 bg-teal-500/10" : "border-border bg-muted hover:bg-accent",
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
                  <label className="block text-xs text-muted-foreground" htmlFor="icon-text">
                    Bottom text
                  </label>
                  <input
                    id="icon-text"
                    value={bottomText}
                    onChange={(e) => setBottomText(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g., AWS Lambda"
                  />
                </div>
              </div>

              <DialogFooter className="mt-2">
                <button
                  onClick={() => setIconOpen(false)}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  disabled={!selected}
                  onClick={() => {
                    if (!selected) return
                    onAddIcon?.({ src: selectedSrc, label: bottomText })
                    setIconOpen(false)
                    setBottomText("")
                    setSearch("")
                    setSelected(null)
                    setCategory("all")
                    setSystemSub("all")
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs",
                    selected ? "border-teal-600 bg-teal-600 text-white" : "border-border bg-card text-muted-foreground",
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
