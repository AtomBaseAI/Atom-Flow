/**
 * Generates lib/lucide-meta.json from the lucide-icons/lucide repository
 * (cloned at the same version as the installed lucide-react package).
 *
 * Usage:  bun scripts/gen-lucide-meta.mjs /tmp/lucide-src
 *
 * The generated file feeds the "system" group of the Add-Icon modal:
 *  - categories: ordered [{ slug, title }] used as sub-groups
 *  - icons:      { "icon-kebab-name": { c: [categorySlugs], t: [tags], a: [aliases] } }
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const repoDir = process.argv[2] || "/tmp/lucide-src"
const outPath = join(process.cwd(), "public", "lucide-meta.json")

const catDir = join(repoDir, "categories")
const iconDir = join(repoDir, "icons")

// 1. Category metadata (slug -> title), sorted by title for a stable order
const categories = readdirSync(catDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => {
    const j = JSON.parse(readFileSync(join(catDir, f), "utf8"))
    return { slug: f.replace(/\.json$/, ""), title: j.title || f.replace(/\.json$/, "") }
  })
  .sort((a, b) => a.title.localeCompare(b.title))

// 2. Icon -> { categories, tags, aliases }
const toStr = (v) => (typeof v === "string" ? v : typeof v === "object" && v && typeof v.name === "string" ? v.name : null)

const icons = {}
for (const f of readdirSync(iconDir)) {
  if (!f.endsWith(".json")) continue
  const name = f.replace(/\.json$/, "")
  const j = JSON.parse(readFileSync(join(iconDir, f), "utf8"))
  icons[name] = {
    c: Array.isArray(j.categories) ? j.categories.filter(toStr).slice(0, 4) : [],
    t: Array.isArray(j.tags) ? j.tags.filter(toStr).slice(0, 8) : [],
    a: Array.isArray(j.aliases) ? j.aliases.map(toStr).filter(Boolean).slice(0, 4) : [],
  }
}

const payload = { version: "0.525.0", categories, icons }
writeFileSync(outPath, JSON.stringify(payload))
const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1)
console.log(`Wrote ${outPath} (${kb} KB) — ${Object.keys(icons).length} icons, ${categories.length} categories`)
