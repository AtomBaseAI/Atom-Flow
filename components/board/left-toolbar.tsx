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
  AppWindow,
  Image as ImageIcon,
  Table2,
  FileCode,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AWS_GROUPS, AWS_ICON_NAMES, ICON_CATEGORIES, ICONS } from "@/lib/icons-manifest"
import { loadLucideRegistry, type LucideEntry, type LucideRegistry } from "@/lib/lucide-icon-registry"
import { DockIn } from "./dock-in"
import { cn } from "@/lib/utils"

type Props = {
  active: "select" | "rect" | "ellipse" | "text" | "hand"
  onChangeTool: (t: Props["active"]) => void
  onQuickAdd?: (t: "rect" | "ellipse" | "text" | "line") => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitView?: () => void
  onOpenExport?: () => void // add export trigger
  onAddIcon?: (opts: { src: string; label: string; style: "icon" | "labeled" | "frame" }) => void
  onAddTag?: () => void // allow adding tag nodes
  onAddTable?: () => void // add a table element at the board center
  onAddCode?: () => void // add a code snippet element at the board center
  /** Splash handover — when false every control stays hidden */
  booted?: boolean
  /** Offset into the global dock-in sequence so the rail follows the header controls */
  bootIndexBase?: number
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

type IconStyleId = "icon" | "labeled" | "frame"

const ICON_STYLE_OPTIONS: {
  id: IconStyleId
  label: string
  hint: string
  Icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "icon", label: "Icon only", hint: "96 × 96", Icon: ImageIcon },
  { id: "labeled", label: "Icon + text", hint: "96 × 96", Icon: Type },
  { id: "frame", label: "Icon frame", hint: "160 × 120", Icon: AppWindow },
]

/**
 * Static, true-to-scale preview of how the icon will land on the board:
 *  - icon    → bare 96×96 icon
 *  - labeled → 96×96 icon with bottom text strip (classic)
 *  - frame   → 160×120 app-window frame (title top-left, 2× icon top-right)
 */
function IconPreview({
  src,
  lucideComp,
  label,
  style,
}: {
  src: string
  lucideComp?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  style: IconStyleId
}) {
  const imgSrc = src.startsWith("lucide:") ? "" : src
  const Glyph = lucideComp
  const borderColor = "var(--af-node-border)"
  const textColor = "var(--af-node-text)"

  if (style === "frame") {
    // Mirrors IconFrameNode: 160×120 app window, 8px title top-left, 2× square icon top-right
    const titleSize = 8
    const frameIconSize = Math.max(16, titleSize * 2)
    return (
      <div
        className="overflow-hidden rounded-[4px] shadow-sm"
        style={{ width: 160, height: 120, background: "var(--af-frame-bg)", border: `1px solid ${borderColor}` }}
      >
        <div className="flex items-center justify-between gap-1 border-b border-black/10 px-1 py-0.5 dark:border-white/15">
          <span
            className="min-w-0 flex-1 truncate text-left font-semibold leading-[1.2]"
            style={{ color: textColor, fontSize: titleSize }}
          >
            {label}
          </span>
          <span className="flex-none" style={{ width: frameIconSize, height: frameIconSize }} aria-hidden>
            {Glyph ? (
              <Glyph className="h-full w-full" style={{ color: borderColor }} aria-hidden />
            ) : imgSrc ? (
              <img src={imgSrc} alt="" className="h-full w-full object-contain" draggable={false} />
            ) : null}
          </span>
        </div>
        <div />
      </div>
    )
  }

  if (style === "icon") {
    return (
      <div
        className="flex items-center justify-center rounded-[2px]"
        style={{ width: 96, height: 96, border: `1px solid ${borderColor}` }}
      >
        {Glyph ? (
          <Glyph className="h-[80%] w-[80%]" style={{ color: borderColor }} aria-hidden />
        ) : (
          <img src={imgSrc || "/placeholder.svg"} alt="" className="h-[85%] w-[85%] object-contain" draggable={false} />
        )}
      </div>
    )
  }

  // labeled — icon with bottom text strip (classic)
  return (
    <div
      className="flex flex-col overflow-hidden rounded-[2px]"
      style={{ width: 96, height: 96, border: `1px solid ${borderColor}` }}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center p-1">
        {Glyph ? (
          <Glyph className="h-[85%] w-[85%]" style={{ color: borderColor }} aria-hidden />
        ) : (
          <img src={imgSrc || "/placeholder.svg"} alt="" className="h-[85%] w-[85%] object-contain" draggable={false} />
        )}
      </div>
      <div className="flex min-h-[24px] flex-none items-center justify-center border-t border-black/10 px-1 dark:border-white/15">
        <span className="w-full truncate text-center text-[8px] font-bold leading-tight" style={{ color: textColor }}>
          {label}
        </span>
      </div>
    </div>
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
  onAddTable,
  onAddCode,
  booted = true,
  bootIndexBase = 0,
}: Props) {
  const [iconOpen, setIconOpen] = React.useState(false)
  const [category, setCategory] = React.useState<(typeof ICON_CATEGORIES)[number]>("all")
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<{ cat: string; name: string } | null>(null)
  const [bottomText, setBottomText] = React.useState("")
  // Icon style for the Add-Icon dialog: bare icon / icon + text / app-window frame
  const [iconStyle, setIconStyle] = React.useState<IconStyleId>("labeled")

  // Lucide "system" group state
  const [systemSub, setSystemSub] = React.useState<string>("all")
  // AWS sub-category state (service groups inside the aws category)
  const [awsSub, setAwsSub] = React.useState<string>("all")
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
  const isAws = category === "aws"

  // AWS service groups, filtered by sub-category chip + search.
  // Search matches both the slug and the human display name ("s3" → Amazon S3).
  const awsGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return AWS_GROUPS.map((g) => ({
      slug: g.slug,
      title: g.title,
      entries: q
        ? g.icons.filter(
            (n) =>
              n.toLowerCase().includes(q) ||
              (AWS_ICON_NAMES[n] ?? "").toLowerCase().includes(q),
          )
        : g.icons,
    })).filter((g) => (awsSub === "all" || g.slug === awsSub) && g.entries.length > 0)
  }, [awsSub, search])
  const awsTotal = React.useMemo(
    () => AWS_GROUPS.reduce((acc, g) => acc + g.icons.length, 0),
    [],
  )

  // Pick an icon tile; prefill the label with its display name — but never
  // stomp a label the user typed themselves (tracked via labelTouchedRef).
  const labelTouchedRef = React.useRef(false)
  const pickIcon = (next: { cat: string; name: string }, display?: string) => {
    setSelected(next)
    if (!labelTouchedRef.current) setBottomText(display ?? "")
  }

  // Human display name of the current selection ("amazon-s3" → "Amazon S3")
  const selectedDisplay = selected
    ? selected.cat === "aws"
      ? AWS_ICON_NAMES[selected.name] ?? selected.name
      : selected.name.replace(/-/g, " ")
    : ""

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
          <DockIn index={bootIndexBase} booted={booted}>
            <ToolBtn
              onClick={() => {
                labelTouchedRef.current = false
                setIconOpen(true)
              }}
              label="Add Icon"
            >
              <Plus className="h-4 w-4" />
            </ToolBtn>
          </DockIn>

          {/* 1. Selection */}
          <DockIn index={bootIndexBase + 1} booted={booted}>
            <ToolBtn active={active === "select"} onClick={() => onChangeTool("select")} label="Select">
              <MousePointer2 className="h-4 w-4" />
            </ToolBtn>
          </DockIn>

          {/* 2. Hand (pan) — sits right under Select like the Figma toolbar */}
          <DockIn index={bootIndexBase + 2} booted={booted}>
            <ToolBtn active={active === "hand"} onClick={() => onChangeTool("hand")} label="Hand">
              <Hand className="h-4 w-4" />
            </ToolBtn>
          </DockIn>

          {/* 3. Square */}
          <DockIn index={bootIndexBase + 3} booted={booted}>
            <ToolBtn
              active={active === "rect"}
              onClick={() => (onQuickAdd ? onQuickAdd("rect") : onChangeTool("rect"))}
              label="Rectangle"
            >
              <Square className="h-4 w-4" />
            </ToolBtn>
          </DockIn>

          {/* 4. Ellipse */}
          <DockIn index={bootIndexBase + 4} booted={booted}>
            <ToolBtn
              active={active === "ellipse"}
              onClick={() => (onQuickAdd ? onQuickAdd("ellipse") : onChangeTool("ellipse"))}
              label="Ellipse"
            >
              <Circle className="h-4 w-4" />
            </ToolBtn>
          </DockIn>

          {/* 5. Line */}
          <DockIn index={bootIndexBase + 5} booted={booted}>
            <ToolBtn onClick={() => (onQuickAdd ? onQuickAdd("line") : onChangeTool("select"))} label="Line">
              <Minus className="h-4 w-4" />
            </ToolBtn>
          </DockIn>

          {/* spacer */}
          <div className="h-1" aria-hidden />

          {/* Tag */}
          <DockIn index={bootIndexBase + 6} booted={booted}>
            <ToolBtn onClick={onAddTag} label="Tag">
              <TagIcon className="h-4 w-4" />
            </ToolBtn>
          </DockIn>

          {/* 7. Text */}
          <DockIn index={bootIndexBase + 7} booted={booted}>
            <ToolBtn
              active={active === "text"}
              onClick={() => (onQuickAdd ? onQuickAdd("text") : onChangeTool("text"))}
              label="Text"
            >
              <Type className="h-4 w-4" />
            </ToolBtn>
          </DockIn>

          {/* Table element */}
          <DockIn index={bootIndexBase + 8} booted={booted}>
            <ToolBtn onClick={onAddTable} label="Table">
              <Table2 className="h-4 w-4" />
            </ToolBtn>
          </DockIn>

          {/* Code snippet element */}
          <DockIn index={bootIndexBase + 9} booted={booted}>
            <ToolBtn onClick={onAddCode} label="Code snippet">
              <FileCode className="h-4 w-4" />
            </ToolBtn>
          </DockIn>

          {/* spacer */}
          <div className="h-1" aria-hidden />

          {/* Zoom controls */}
          <DockIn index={bootIndexBase + 10} booted={booted}>
            <ToolBtn onClick={onZoomIn} label="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </ToolBtn>
          </DockIn>
          <DockIn index={bootIndexBase + 11} booted={booted}>
            <ToolBtn onClick={onZoomOut} label="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </ToolBtn>
          </DockIn>
          <DockIn index={bootIndexBase + 12} booted={booted}>
            <ToolBtn onClick={onFitView} label="Fit view">
              <Scan className="h-4 w-4" />
            </ToolBtn>
          </DockIn>

          {/* Undo / Redo */}
          <DockIn index={bootIndexBase + 13} booted={booted}>
            <ToolBtn
              onClick={() => {
                if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("board:undo"))
              }}
              label="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </ToolBtn>
          </DockIn>
          <DockIn index={bootIndexBase + 14} booted={booted}>
            <ToolBtn
              onClick={() => {
                if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("board:redo"))
              }}
              label="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </ToolBtn>
          </DockIn>
        </div>

        {/* Dialog replacement */}
        {iconOpen && (
          <Dialog open={iconOpen} onOpenChange={setIconOpen}>
            <DialogContent
              className={cn(
                "border-border bg-card text-foreground",
                // Centering, sizing and viewport-fit fixes
                "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                // Wide split layout: ~70% picker / ~30% preview (md: beats shadcn's sm:max-w-lg)
                // grid-cols-1 caps the implicit auto track (minmax(0,1fr)) so wide one-line
                // content (e.g. lucide sub-group chips) can't blow the layout past the dialog
                "max-h-[90vh] w-[96vw] overflow-x-hidden overflow-y-auto md:max-w-6xl grid-cols-1",
                "p-4 rounded-lg shadow-xl",
              )}
            >
              <DialogHeader>
                <DialogTitle className="text-foreground text-sm">Add Icon</DialogTitle>
                <DialogDescription className="sr-only">
                  Choose an icon, pick an icon style (icon only, icon with text, or icon frame), preview it live, then add it to the board
                </DialogDescription>
              </DialogHeader>

              <div className="flex w-full min-w-0 flex-col gap-4 md:flex-row">
                {/* LEFT ~70% — icon picker (flex-grow ratio keeps 70/30 exact after the gap) */}
                <div className="min-w-0 space-y-3 md:flex-[7_1_0%]">
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
                          setAwsSub("all")
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
                  {/* AWS sub-categories (service groups) */}
                  {isAws && (
                    <div className="max-h-20 overflow-y-auto rounded-md border border-border bg-background p-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setAwsSub("all")}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px]",
                            awsSub === "all"
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-border bg-card text-muted-foreground hover:bg-accent",
                          )}
                          aria-pressed={awsSub === "all"}
                        >
                          all ({awsTotal})
                        </button>
                        {AWS_GROUPS.map((g) => (
                          <button
                            key={g.slug}
                            onClick={() => setAwsSub(g.slug)}
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px]",
                              awsSub === g.slug
                                ? "border-teal-600 bg-teal-600 text-white"
                                : "border-border bg-card text-muted-foreground hover:bg-accent",
                            )}
                            aria-pressed={awsSub === g.slug}
                          >
                            {g.title.toLowerCase()} ({g.icons.length})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
                              containIntrinsicSize: `auto ${Math.ceil(g.entries.length / 10) * 60 + 34}px`,
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
                                  onSelect={() => pickIcon({ cat: "system", name: e.name }, e.name)}
                                />
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    )
                  ) : isAws ? (
                    awsGroups.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">No icons found</div>
                    ) : (
                      <div className="space-y-4">
                        {awsGroups.map((g) => (
                          <section
                            key={g.slug}
                            data-group={g.slug}
                            style={{
                              contentVisibility: "auto",
                              containIntrinsicSize: `auto ${Math.ceil(g.entries.length / 10) * 60 + 34}px`,
                            } as React.CSSProperties}
                          >
                            <header className="flex items-center justify-between px-1 pb-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {g.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70">{g.entries.length}</span>
                            </header>
                            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
                              {g.entries.map((name) => {
                                const isSel = selected?.cat === "aws" && selected?.name === name
                                const label = AWS_ICON_NAMES[name] ?? name
                                return (
                                  <button
                                    key={name}
                                    onClick={() => pickIcon({ cat: "aws", name }, label)}
                                    className={cn(
                                      "flex aspect-square items-center justify-center rounded border p-1",
                                      isSel ? "border-teal-600 bg-teal-500/10" : "border-border bg-muted hover:bg-accent",
                                    )}
                                    title={label}
                                    aria-pressed={isSel}
                                    aria-label={`Select ${label} icon`}
                                  >
                                    <img
                                      src={`/vectors/aws/${name}.svg`}
                                      alt={label}
                                      className="max-h-full max-w-full object-contain"
                                      draggable={false}
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  </button>
                                )
                              })}
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
                            onClick={() => pickIcon({ cat: it.cat, name: it.name }, it.name.replace(/-/g, " "))}
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
                              loading="lazy"
                              decoding="async"
                            />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                </div>

                {/* RIGHT ~30% — style selector + live preview */}
                <aside
                  className="flex min-w-0 flex-col gap-3 md:flex-[3_1_0%] md:border-l md:border-border md:pl-4"
                  aria-label="Icon style and preview"
                >
                  {/* Style selector */}
                  <div className="space-y-1.5">
                    <span className="block text-xs text-muted-foreground">Icon style</span>
                    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Icon style">
                      {ICON_STYLE_OPTIONS.map((o) => {
                        const activeStyle = iconStyle === o.id
                        return (
                          <button
                            key={o.id}
                            role="radio"
                            aria-checked={activeStyle}
                            onClick={() => setIconStyle(o.id)}
                            title={o.hint}
                            className={cn(
                              "flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[10px] leading-tight transition-colors",
                              activeStyle
                                ? "border-teal-600 bg-teal-500/10 text-foreground"
                                : "border-border bg-card text-muted-foreground hover:bg-accent",
                            )}
                          >
                            <o.Icon className="h-4 w-4" aria-hidden />
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Live preview stage */}
                  <div className="relative flex min-h-[220px] flex-1 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                    <div
                      className="absolute inset-0 opacity-40"
                      style={{
                        backgroundImage: "radial-gradient(var(--af-bg-pattern) 1px, transparent 1px)",
                        backgroundSize: "12px 12px",
                      }}
                      aria-hidden
                    />
                    <div className="relative z-10 flex flex-col items-center gap-3">
                      {selected ? (
                        <IconPreview
                          src={selectedSrc}
                          lucideComp={selectedLucide?.comp}
                          label={bottomText.trim() || selectedDisplay}
                          style={iconStyle}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ImageIcon className="h-8 w-8 opacity-40" aria-hidden />
                          <span className="text-xs">Select an icon to preview</span>
                        </div>
                      )}
                      {selected && (
                        <div className="max-w-[200px] text-center">
                          <div className="truncate text-xs text-foreground" title={selectedDisplay}>
                            {selectedDisplay}
                          </div>
                          <div className="text-[10px] text-muted-foreground/70">
                            {(() => {
                              const opt = ICON_STYLE_OPTIONS.find((o) => o.id === iconStyle)
                              return opt ? `${opt.label} · ${opt.hint}` : ""
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Label input — hidden for bare icons */}
                  {iconStyle === "icon" ? (
                    <p className="text-[10px] text-muted-foreground">
                      Adds the bare icon at 96 × 96 — no label, no frame.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <label className="block text-xs text-muted-foreground" htmlFor="icon-text">
                        {iconStyle === "frame" ? "Frame title" : "Bottom text"}
                      </label>
                      <input
                        id="icon-text"
                        value={bottomText}
                        onChange={(e) => {
                          const v = e.target.value
                          setBottomText(v)
                          // A non-empty manual edit locks the label; clearing
                          // releases it so the next pick can prefill again.
                          labelTouchedRef.current = v.trim().length > 0
                        }}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="e.g., AWS Lambda"
                      />
                    </div>
                  )}
                </aside>
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
                    onAddIcon?.({ src: selectedSrc, label: bottomText, style: iconStyle })
                    setIconOpen(false)
                    setBottomText("")
                    setSearch("")
                    setSelected(null)
                    setCategory("all")
                    setSystemSub("all")
                    setAwsSub("all")
                    setIconStyle("labeled")
                    labelTouchedRef.current = false
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
