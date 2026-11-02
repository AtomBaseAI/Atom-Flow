/**
 * Imports the official AWS Architecture Icons from upload/ICOAWS_NEW.zip.
 *
 * Pipeline:
 *  1. Extracts the archive to a temp dir (fresh on every run).
 *  2. Walks the official category folders (Arch_Compute, Arch_Storage, ...)
 *     and analyses every icon — SKIPS .png files, .DS_Store, macOS AppleDouble
 *     (`._*`) junk and __MACOSX metadata entirely.
 *  3. Derives a proper slug ("aws-lambda") and display name ("AWS Lambda")
 *     from each official filename (Arch_AWS-Lambda_64.svg).
 *  4. De-duplicates icons the archive publishes in two folders (pinned to the
 *     AWS console home category via CATEGORY_OVERRIDES).
 *  5. Copies the SVGs to public/vectors/aws/<slug>.svg.
 *  6. Writes lib/aws-icons.generated.ts (grouped + display names) which
 *     lib/icons-manifest.ts re-exports.
 *
 * Run: bun scripts/import-aws-icons.ts
 */
import { $ } from "bun"
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs"
import path from "path"

const ROOT = path.resolve(import.meta.dir, "..")
const ZIP = path.join(ROOT, "upload", "ICOAWS_NEW.zip")
const WORK = "/tmp/icoaws-new-import"
const SRC = path.join(WORK, "ICOAWS_NEW")
const OUT_DIR = path.join(ROOT, "public", "vectors", "aws")
const OUT_TS = path.join(ROOT, "lib", "aws-icons.generated.ts")

/** Official category folder → group title shown in the UI (in this order). */
const CATEGORIES: Array<[folder: string, title: string]> = [
  ["Arch_Compute", "Compute"],
  ["Arch_Containers", "Containers"],
  ["Arch_Databases", "Databases"],
  ["Arch_Storage", "Storage"],
  ["Arch_Networking-Content-Delivery", "Networking & Content Delivery"],
  ["Arch_Security-Identity", "Security, Identity & Compliance"],
  ["Arch_Analytics", "Analytics"],
  ["Arch_Application-Integration", "Application Integration"],
  ["Arch_Artificial-Intelligence", "AI & Machine Learning"],
  ["Arch_Management-Tools", "Management & Governance"],
  ["Arch_Developer-Tools", "Developer Tools"],
  ["Arch_Migration-Modernization", "Migration & Modernization"],
  ["Arch_Media-Services", "Media Services"],
  ["Arch_Blockchain", "Blockchain"],
]

/** Icons the archive ships in TWO folders — pin them to one category. */
const CATEGORY_OVERRIDES: Record<string, string> = {
  "aws-compute-optimizer": "Arch_Management-Tools", // also in Arch_Compute
  "amazon-kinesis-video-streams": "Arch_Analytics", // also in Arch_Media-Services
}

/** Well-known short names that beat the verbose official filename. */
const NAME_OVERRIDES: Record<string, string> = {
  "amazon-simple-storage-service": "Amazon S3",
  "amazon-simple-storage-service-glacier": "Amazon S3 Glacier",
  "amazon-simple-queue-service": "Amazon SQS",
  "amazon-simple-notification-service": "Amazon SNS",
  "amazon-elastic-kubernetes-service": "Amazon EKS",
  "amazon-elastic-container-service": "Amazon ECS",
  "amazon-elastic-container-registry": "Amazon ECR",
  "amazon-virtual-private-cloud": "Amazon VPC",
  "amazon-elastic-block-store": "Amazon EBS",
  "aws-identity-and-access-management": "AWS IAM",
  "aws-key-management-service": "AWS KMS",
  "aws-database-migration-service": "AWS DMS",
  "aws-resource-access-manager": "AWS RAM",
  "aws-private-certificate-authority": "AWS Private CA",
  "aws-command-line-interface": "AWS CLI",
  "aws-cloud-development-kit": "AWS CDK",
  "amazon-managed-streaming-for-apache-kafka": "Amazon MSK",
  "amazon-managed-workflows-for-apache-airflow": "Amazon MWAA",
  "amazon-augmented-ai-a2i": "Amazon A2I",
  "amazon-interactive-video-service": "Amazon IVS",
  "amazon-fsx-for-wfs": "Amazon FSx for Windows File Server",
}

/** "AWS-Lambda" → "aws-lambda"; "AWS-Elemental-Appliances-&-Software" → "aws-elemental-appliances-and-software". */
function slugify(base: string): string {
  return base
    .toLowerCase()
    .replace(/&/g, "-and-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** "Arch_AWS-Lambda_64.svg" → "AWS Lambda" (filename casing is kept). */
function displayName(base: string, slug: string): string {
  const raw = base.replace(/-/g, " ").replace(/\s+/g, " ").trim()
  return NAME_OVERRIDES[slug] ?? raw
}

// --- 1. Extract -------------------------------------------------------------
rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })
if (!existsSync(ZIP)) {
  console.error(`✗ archive not found: ${ZIP}`)
  process.exit(1)
}
await $`unzip -o -q ${ZIP} -d ${WORK}`.quiet()
console.log(`✓ extracted ${path.basename(ZIP)}`)

// --- 2. Analyse -------------------------------------------------------------
type Icon = { id: string; name: string; srcFile: string }
type Group = { slug: string; title: string; icons: Icon[] }

const byCategory = new Map<string, Icon[]>(
  CATEGORIES.map(([folder]) => [folder, []]),
)
const seen = new Map<string, string>() // slug → folder of first sighting
let pngSkipped = 0
let junkSkipped = 0
let dupSkipped = 0
let total = 0

for (const [folder] of CATEGORIES) {
  const dir = path.join(SRC, folder)
  if (!existsSync(dir)) {
    console.warn(`⚠ missing category folder: ${folder}`)
    continue
  }
  // Walk category dir recursively (icons live in 64/), skipping all junk.
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith("__MACOSX")) continue
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      const lower = entry.name.toLowerCase()
      if (lower.endsWith(".png")) {
        pngSkipped++
        continue // skip .png files per requirement
      }
      if (entry.name.startsWith("._") || lower === ".ds_store" || entry.name.startsWith(".")) {
        junkSkipped++
        continue // macOS AppleDouble / metadata junk
      }
      if (!lower.endsWith(".svg")) continue
      // "Arch_AWS-Lambda_64.svg" — strip .svg ext, Arch_ prefix and _64 suffix
      const base = entry.name
        .replace(/\.svg$/i, "")
        .replace(/^Arch_/i, "")
        .replace(/_64$/i, "")
      const slug = slugify(base)
      if (seen.has(slug)) {
        dupSkipped++ // already placed in its pinned/first category
        continue
      }
      const owner = CATEGORY_OVERRIDES[slug] ?? folder
      seen.set(slug, owner)
      byCategory.get(owner)!.push({ id: slug, name: displayName(base, slug), srcFile: full })
      total++
    }
  }
  walk(dir)
}

// --- 3. Copy ----------------------------------------------------------------
rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })
const groups: Group[] = []
for (const [folder, title] of CATEGORIES) {
  const icons = byCategory.get(folder)!
  if (icons.length === 0) continue
  for (const icon of icons) {
    cpSync(icon.srcFile, path.join(OUT_DIR, `${icon.id}.svg`))
  }
  groups.push({
    slug: slugify(title),
    title,
    icons: icons.map(({ id, name }) => ({ id, name })),
  })
}

// --- 4. Generate TS ---------------------------------------------------------
const header = `// AUTO-GENERATED by scripts/import-aws-icons.ts — do not edit by hand.
// Source: ICOAWS_NEW.zip (official AWS Architecture Icons, 64px, ${total} icons).
// Each icon id maps to /vectors/aws/<id>.svg.

export type AwsIconMeta = { id: string; name: string }
export type AwsIconGroup = { slug: string; title: string; icons: AwsIconMeta[] }

export const AWS_ICON_GROUPS: AwsIconGroup[] = `

const body =
  JSON.stringify(
    groups.map((g) => ({ slug: g.slug, title: g.title, icons: g.icons })),
    null,
    2,
  ) + "\n"

const names = `// slug → human display name (hover tooltips, search, canvas labels)
export const AWS_ICON_NAMES: Record<string, string> = ${JSON.stringify(
  Object.fromEntries(groups.flatMap((g) => g.icons.map((i) => [i.id, i.name]))),
  null,
  2,
)}
`

mkdirSync(path.dirname(OUT_TS), { recursive: true })
await Bun.write(OUT_TS, header + body + names)

// --- 5. Report --------------------------------------------------------------
console.log(`\n✓ imported ${total} AWS icons into public/vectors/aws/`)
console.log(`  skipped: ${pngSkipped} .png · ${junkSkipped} macOS junk · ${dupSkipped} duplicates`)
console.log(`✓ wrote ${path.relative(ROOT, OUT_TS)}`)
for (const g of groups) {
  console.log(`  ${g.title.padEnd(32)} ${String(g.icons.length).padStart(3)}`)
}
