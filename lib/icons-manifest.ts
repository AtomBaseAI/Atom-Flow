import { AWS_ICON_GROUPS, AWS_ICON_NAMES } from "./aws-icons.generated"

export const ICON_CATEGORIES = ["all", "system", "language", "framework", "testing","browser", "database","files", "cloud","os", "dev", "aws"] as const

// Keep filenames in sync with /public/vectors structure.
// You can add more here later without changing any code.
// "system" is handled separately: it renders Lucide icons (see lib/lucide-icon-registry.ts).
// "aws" is generated from the official AWS Architecture Icons set by
// scripts/import-aws-icons.ts (see lib/aws-icons.generated.ts).
export const ICONS: Record<Exclude<(typeof ICON_CATEGORIES)[number], "all" | "system">, string[]> = {
  language: [
    "c",
    "cpp",
    "csharp",
    "dart",
    "go",
    "java",
    "js",
    "json",
    "php",
    "python",
    "ruby",
    "typescript",
    "sql"
  ],
  framework: [
    "angular",
    "django",
    "express",
    "flask",
    "flutter",
    "node",
    "react-lib",
    "spring",
    "vue"
  ],
  testing: [
    "cucumber-bdd",
    "jest",
    "junit5",
    "mocha",
    "playwright",
    "puppeteer",
    "selenium"
  ],
  browser:[
    "firefox",
    "chrome",
    "edge",
    "opera",
    "safari",
    "ie"
  ],
  cloud: [
    "aws",
    "azure",
    "firebase",
    "gcp",
    "oracle",
    "netlify",
    "vercel"
  ],
  database: [
    "cassandra",
    "mariadb",
    "mongodb",
    "ms-sql",
    "mysql",
    "postgresql",
    "redis",
    "sqlite"
  ],
  files:[
   "txt",
   "pdf",
   "jpg",
   "png",
   "svg",
   "mp3",
   "mp4",
   "zip",
   "exe",
   "iso",
   "csv",
   "figma",
   "excel",
   "ppt",
   "word",
   "animate",
   "after-effects",
   "photoshop",
   "illustrator",
   "lightroom",
   "premiere",
   "xd"
  ],
  os:[
      "ubuntu",
      "centos",
      "debian",
      "fedora",
      "kalilinux",
      "linux-mint",
      "android",
      "windows",
      "ios",
      "macos"
  ],
  dev: [
    "api",
    "auth",
    "auth0",
    "desktop",
    "email",
    "gmail",
    "insomnia",
    "jwt",
    "key",
    "mobile",
    "table",
    "vscode",
    "web"

  ],
  // Flat union of every AWS group below (253 icons).
  aws: AWS_ICON_GROUPS.flatMap((g) => g.icons.map((i) => i.id)),
}

// ---------------------------------------------------------------------------
// AWS resource icons (official AWS "Architecture Icons" set, 64px).
// Grouped by the official AWS category folders shipped in ICOAWS_NEW.zip;
// display names are exported alongside so the UI can show "Amazon S3"
// instead of the raw slug. Regenerate via: bun scripts/import-aws-icons.ts
// ---------------------------------------------------------------------------
export const AWS_GROUPS = AWS_ICON_GROUPS.map((g) => ({
  slug: g.slug,
  title: g.title,
  icons: g.icons.map((i) => i.id),
}))

// slug → human display name ("amazon-simple-storage-service" → "Amazon S3")
export { AWS_ICON_NAMES }

export type AwsGroup = (typeof AWS_GROUPS)[number]
export const AWS_GROUP_SLUGS = AWS_GROUPS.map((g) => g.slug)
