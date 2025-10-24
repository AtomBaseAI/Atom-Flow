export const ICON_CATEGORIES = ["all", "language", "framework", "testing","browser", "database","files", "cloud","os", "dev", "aws"] as const

// Keep filenames in sync with /public/vectors structure.
// You can add more here later without changing any code.
export const ICONS: Record<Exclude<(typeof ICON_CATEGORIES)[number], "all">, string[]> = {
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
  aws: [
    "ebs",
    "ec2",
    "lambda",
    "lightsail"
  ],
}
