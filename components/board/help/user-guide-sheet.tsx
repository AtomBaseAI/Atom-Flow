"use client"

/**
 * UserGuideSheet — full-screen help center for Atom Flow.
 *
 * Rendered as a shadcn Sheet that slides in from the RIGHT edge across the
 * whole viewport (full width & height, sweeping right-to-left over the board):
 * a documentation-style two-pane view — section navigation with a quick
 * search on the left (chips on mobile), the full guide on the right. The
 * quick search filters sections, counts matching blocks and highlights every
 * occurrence inside the rendered text. Sections can embed hand-drawn SVG
 * figures (see guide-figures.tsx) so each chapter explains itself visually.
 *
 * z-[80] on the panel and the overlay keeps both above the board's
 * pseudo-fullscreen layer (z-[60]) and the radial menu (z-[70]).
 * Opening shortcuts: the Help button, F1 or "?" anywhere on the board.
 */

import * as React from "react"
import { BookOpen, Lightbulb, Search, X } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  GUIDE_SECTIONS,
  guideBlockText,
  guideSectionText,
  type GuideBlock,
  type GuideSection,
} from "./guide-content"
import { GuideFigure } from "./guide-figures"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Splits text around case-insensitive token occurrences, wrapping them in <mark>. */
function Highlighted({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>

  const lower = text.toLowerCase()
  const ranges: [number, number][] = []
  for (const t of tokens) {
    let i = 0
    for (;;) {
      const idx = lower.indexOf(t, i)
      if (idx === -1) break
      ranges.push([idx, idx + t.length])
      i = idx + t.length
    }
  }
  if (ranges.length === 0) return <>{text}</>

  // Merge overlapping ranges (tokens can collide: "edge" + "edges")
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: [number, number][] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }

  const out: React.ReactNode[] = []
  let cursor = 0
  merged.forEach(([s, e], i) => {
    if (s > cursor) out.push(<React.Fragment key={`t${i}`}>{text.slice(cursor, s)}</React.Fragment>)
    out.push(
      <mark
        key={`m${i}`}
        className="rounded-[3px] bg-teal-400/30 px-0.5 text-foreground dark:bg-teal-300/25"
      >
        {text.slice(s, e)}
      </mark>,
    )
    cursor = e
  })
  if (cursor < text.length) out.push(<React.Fragment key="tail">{text.slice(cursor)}</React.Fragment>)
  return <>{out}</>
}

function GuideBlockView({ block, tokens }: { block: GuideBlock; tokens: string[] }) {
  switch (block.kind) {
    case "p":
      return (
        <p className="text-sm leading-relaxed text-foreground/90">
          <Highlighted text={block.text} tokens={tokens} />
        </p>
      )
    case "steps":
      return (
        <ol className="space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-teal-500/15 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
              >
                {i + 1}
              </span>
              <span>
                <Highlighted text={item} tokens={tokens} />
              </span>
            </li>
          ))}
        </ol>
      )
    case "list":
      return (
        <ul className="space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
              <span aria-hidden className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-teal-500/70" />
              <span>
                <Highlighted text={item} tokens={tokens} />
              </span>
            </li>
          ))}
        </ul>
      )
    case "tip":
      return (
        <div className="flex gap-2.5 rounded-lg border border-teal-500/30 bg-teal-500/[0.08] p-3">
          <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 flex-none text-teal-600 dark:text-teal-400" />
          <p className="text-sm leading-relaxed text-foreground/90">
            <span className="mr-1 font-semibold text-teal-700 dark:text-teal-300">Tip:</span>
            <Highlighted text={block.text} tokens={tokens} />
          </p>
        </div>
      )
    case "figure":
      return (
        <figure className="overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm">
          <GuideFigure id={block.figure} />
          <figcaption className="border-t border-border px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            <Highlighted text={block.caption} tokens={tokens} />
          </figcaption>
        </figure>
      )
    case "shortcuts":
      return (
        <div className="overflow-hidden rounded-lg border border-border" role="table" aria-label="Keyboard shortcuts">
          {block.rows.map((row, i) => (
            <div
              key={i}
              role="row"
              className={cn("flex items-center gap-4 px-3 py-2", i % 2 === 1 && "bg-muted/40")}
            >
              <div role="cell" className="flex w-28 flex-none flex-wrap gap-1 sm:w-36">
                {row.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
              <span role="cell" className="text-sm text-foreground/90">
                <Highlighted text={row.desc} tokens={tokens} />
              </span>
            </div>
          ))}
        </div>
      )
  }
}

function SearchInput({
  query,
  setQuery,
  searchRef,
  onEnter,
}: {
  query: string
  setQuery: (v: string) => void
  searchRef?: React.RefObject<HTMLInputElement | null>
  onEnter: () => void
}) {
  return (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={searchRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter()
          // Note: Escape is intentionally NOT handled here. Radix closes the
          // sheet from a document-level key listener which React's
          // stopPropagation cannot stop — the "clear search first" behavior
          // lives in SheetContent's onEscapeKeyDown instead.
        }}
        placeholder="Search the guide…"
        aria-label="Search the guide"
        className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-8 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-teal-500"
      />
      {query && (
        <button
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}

export default function UserGuideSheet({ open, onOpenChange }: Props) {
  const [query, setQuery] = React.useState("")
  const [activeId, setActiveId] = React.useState(GUIDE_SECTIONS[0]?.id ?? "")
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const sectionRefs = React.useRef<Map<string, HTMLElement>>(new Map())
  const searchRef = React.useRef<HTMLInputElement>(null)

  const tokens = React.useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )

  const searching = tokens.length > 0

  const visibleSections = React.useMemo(() => {
    if (!searching) return GUIDE_SECTIONS
    return GUIDE_SECTIONS.filter((s) => {
      const hay = guideSectionText(s).toLowerCase()
      return tokens.every((t) => hay.includes(t))
    })
  }, [searching, tokens])

  /** Number of blocks in a section that contain every token (search mode). */
  const matchCount = React.useCallback(
    (s: GuideSection) =>
      s.blocks.filter((b) => {
        const hay = guideBlockText(b).toLowerCase()
        return tokens.every((t) => hay.includes(t))
      }).length,
    [tokens],
  )

  // Fresh state each time the guide opens: clear the query, rewind the scroll
  // and (on desktop) park the caret in the search box so typing starts instantly.
  React.useEffect(() => {
    if (!open) return
    setQuery("")
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    const t = window.setTimeout(() => {
      if (window.matchMedia("(min-width: 768px)").matches) searchRef.current?.focus()
    }, 150)
    return () => window.clearTimeout(t)
  }, [open])

  // Global opener: F1 (and "?") bring the guide up from anywhere on the board.
  // Skipped while typing in inputs/labels so "?" can still be typed as text.
  React.useEffect(() => {
    if (open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F1" && e.key !== "?") return
      const target = e.target as HTMLElement | null
      const editing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      if (e.key === "?" && editing) return
      e.preventDefault()
      onOpenChange(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  // When the filtered list changes (search typing), reset the active highlight
  React.useEffect(() => {
    setActiveId(visibleSections[0]?.id ?? "")
  }, [visibleSections])

  const jumpTo = React.useCallback((id?: string) => {
    if (!id) return
    const el = sectionRefs.current.get(id)
    const container = scrollRef.current
    if (!el || !container) return
    container.scrollTo({ top: Math.max(0, el.offsetTop - 12), behavior: "smooth" })
    setActiveId(id)
  }, [])

  // Scroll-spy: the section whose heading is nearest below the viewport top
  // wins; snapping to the very bottom selects the last visible section.
  const handleScroll = React.useCallback(() => {
    const container = scrollRef.current
    if (!container || visibleSections.length === 0) return
    const containerTop = container.getBoundingClientRect().top
    let current = visibleSections[0].id
    for (const s of visibleSections) {
      const el = sectionRefs.current.get(s.id)
      if (!el) continue
      if (el.getBoundingClientRect().top - containerTop <= 96) current = s.id
      else break
    }
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 4) {
      current = visibleSections[visibleSections.length - 1].id
    }
    setActiveId(current)
  }, [visibleSections])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        overlayClassName="z-[80]"
        className={cn(
          // Full viewport coverage like the previous dialog, but entering from
          // the right edge (slide-in-from-right = sweeps right-to-left).
          // h-dvh (not h-full) because Radix portals the sheet into <body>,
          // whose height is the page content — h-full would resolve against
          // that, not the viewport. The sheet's own w-3/4 / sm:max-w-sm / p-6 /
          // z-50 are merged away.
          "z-[80] flex h-dvh w-screen max-w-none flex-col gap-0 rounded-none border-l border-border p-0 sm:max-w-none",
        )}
        aria-describedby={undefined}
        onEscapeKeyDown={(e) => {
          // First Escape while a search is active only clears it — the guide
          // stays open; a second Escape (empty search) closes as usual.
          if (query) {
            e.preventDefault()
            setQuery("")
          }
        }}
      >
        {/* Header */}
        <header className="flex flex-none items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-base font-semibold leading-tight">
                Atom Flow — User Guide
              </SheetTitle>
              <SheetDescription className="truncate text-xs text-muted-foreground">
                Everything you need to draw beautiful architecture diagrams
              </SheetDescription>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close guide"
            className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar — section nav + quick search (desktop) */}
          <aside className="hidden w-72 flex-none flex-col border-r border-border bg-muted/30 md:flex">
            <div className="p-3">
              <SearchInput
                query={query}
                setQuery={setQuery}
                searchRef={searchRef}
                onEnter={() => jumpTo(visibleSections[0]?.id)}
              />
            </div>
            <nav aria-label="Guide sections" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {visibleSections.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No sections match “{query}”
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {visibleSections.map((s, i) => {
                    const Icon = s.icon
                    const active = activeId === s.id
                    const count = searching ? matchCount(s) : 0
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => jumpTo(s.id)}
                          aria-current={active || undefined}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                            active
                              ? "bg-teal-500/15 font-medium text-teal-700 dark:text-teal-300"
                              : "text-foreground/80 hover:bg-accent",
                          )}
                        >
                          <Icon
                            aria-hidden
                            className={cn(
                              "h-4 w-4 flex-none",
                              active ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground",
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            <Highlighted text={s.title} tokens={tokens} />
                          </span>
                          {searching && count > 0 && (
                            <span className="flex-none rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-teal-700 dark:text-teal-300">
                              {count}
                            </span>
                          )}
                          {!searching && (
                            <span className="flex-none text-[10px] tabular-nums text-muted-foreground">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </nav>
            <div className="flex-none border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
              Tip: press{" "}
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                F1
              </kbd>{" "}
              anytime to open this guide
            </div>
          </aside>

          {/* Right pane: mobile search + chips, then the guide content */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-none space-y-2 border-b border-border p-3 md:hidden">
              <SearchInput query={query} setQuery={setQuery} onEnter={() => jumpTo(visibleSections[0]?.id)} />
              {!searching && (
                <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Guide sections">
                  {GUIDE_SECTIONS.map((s) => {
                    const Icon = s.icon
                    const active = activeId === s.id
                    return (
                      <button
                        key={s.id}
                        role="tab"
                        aria-selected={active}
                        onClick={() => jumpTo(s.id)}
                        className={cn(
                          "inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                          active
                            ? "border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300"
                            : "border-border bg-card text-foreground/80",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {s.title}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <main
              ref={scrollRef}
              onScroll={handleScroll}
              className="relative min-h-0 flex-1 overflow-y-auto"
            >
              <div className="mx-auto max-w-3xl px-4 py-6 md:px-10 md:py-8">
                {visibleSections.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-24 text-center">
                    <Search aria-hidden className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No results for “{query}”</p>
                    <p className="text-xs text-muted-foreground">
                      Try a shorter word — for example “icon”, “edge” or “export”.
                    </p>
                    <button
                      onClick={() => setQuery("")}
                      className="mt-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  visibleSections.map((s, i) => {
                    const Icon = s.icon
                    return (
                      <section
                        key={s.id}
                        id={`guide-${s.id}`}
                        aria-labelledby={`guide-${s.id}-title`}
                        ref={(el) => {
                          if (el) sectionRefs.current.set(s.id, el)
                          else sectionRefs.current.delete(s.id)
                        }}
                        className="scroll-mt-6 border-b border-border/60 py-6 first:pt-0 last:border-b-0 md:py-8"
                      >
                        <div className="mb-4 flex items-center gap-3">
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400">
                            <Icon className="h-5 w-5" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <h2
                              id={`guide-${s.id}-title`}
                              className="text-lg font-semibold leading-tight"
                            >
                              <Highlighted text={s.title} tokens={tokens} />
                            </h2>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Section {i + 1} of {visibleSections.length}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3.5">
                          {s.blocks.map((b, bi) => (
                            <GuideBlockView key={bi} block={b} tokens={tokens} />
                          ))}
                        </div>
                      </section>
                    )
                  })
                )}
              </div>
            </main>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
