import type { MetadataRoute } from "next"

const DESCRIPTION =
  "Free online architecture diagram board with 250+ cloud & AWS icons, smart self-routing connections and PNG/SVG/JSON export — no sign-up, runs in your browser."

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atom Flow — Free Online Architecture Diagram Tool",
    short_name: "Atom Flow",
    description: DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#14b8a6",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  }
}
