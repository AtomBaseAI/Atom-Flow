import type { LucideIcon } from "lucide-react"
import {
  Download,
  Eye,
  Image as ImageIcon,
  Keyboard,
  Lightbulb,
  Lock,
  Map,
  MousePointerClick,
  Orbit,
  Palette,
  Shapes,
  Sparkles,
  Spline,
  Waypoints,
} from "lucide-react"

/**
 * User-guide content model.
 *
 * Blocks are intentionally tiny (a paragraph, a step list, a tip, a shortcut
 * table, a drawn figure) so the quick search can rank and highlight them
 * precisely. Everything is plain text — no markdown — because the renderer
 * styles each block kind; figures reference hand-drawn SVG illustrations
 * rendered by guide-figures.tsx.
 */

/** Ids of the hand-drawn illustrations rendered by guide-figures.tsx. */
export type GuideFigureId =
  | "welcome"
  | "workspace"
  | "quick-menu"
  | "add-elements"
  | "icons"
  | "connect"
  | "style-elements"
  | "style-connections"
  | "edit"
  | "view"
  | "lock"
  | "import-export"

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "tip"; text: string }
  | { kind: "figure"; figure: GuideFigureId; caption: string }
  | { kind: "shortcuts"; rows: { keys: string[]; desc: string }[] }

export type GuideSection = {
  id: string
  title: string
  icon: LucideIcon
  blocks: GuideBlock[]
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "welcome",
    title: "Welcome to Atom Flow",
    icon: Sparkles,
    blocks: [
      {
        kind: "p",
        text: "Atom Flow is a friendly canvas for drawing app, network and cloud architecture diagrams — no design experience needed. If you can drag a picture, you can use Atom Flow.",
      },
      {
        kind: "figure",
        figure: "welcome",
        caption: "Three building blocks joined by smart connections — this can be your first diagram in about two minutes.",
      },
      { kind: "p", text: "Here is what you can do in a couple of minutes:" },
      {
        kind: "steps",
        items: [
          "Add building blocks — shapes, icons, text, tables and code snippets — from the left tool rail.",
          "Connect them with smart lines that automatically route around other elements.",
          "Style everything with the bottom bar: colors, borders, text and rotation.",
          "Save your work as PNG, SVG or a re-openable project file — the board also saves itself automatically.",
        ],
      },
      {
        kind: "tip",
        text: "New here? Read “Know your workspace” next — it points out every button on the screen in one pass.",
      },
    ],
  },
  {
    id: "quick-menu",
    title: "Quick menu — tap or right-click",
    icon: Orbit,
    blocks: [
      {
        kind: "figure",
        figure: "quick-menu",
        caption: "The round quick menu opens exactly where you tapped — pick an action, tap the dark backdrop or the ✕ hub to close.",
      },
      {
        kind: "p",
        text: "Atom Flow's fastest shortcut is not on the keyboard — it is the circular quick menu that pops up right under your finger, with the everyday actions fanned around it.",
      },
      {
        kind: "steps",
        items: [
          "Mouse or trackpad — right-click any empty spot of the canvas. On a Mac trackpad, click with two fingers.",
          "Touch screens and tablets — tap once with two fingers at the same time (a quick two-finger tap, not a pinch).",
          "The menu fans out around the point you tapped. Choose an action, or tap the dark backdrop / press Escape to close it.",
        ],
      },
      {
        kind: "list",
        items: [
          "Add shape — drops a rectangle exactly at the tapped spot.",
          "Select & Hand — switch between editing and panning; the active tool glows teal.",
          "Fit view — frames your whole diagram instantly.",
          "Lock board — freezes the board into view-only present mode.",
          "Fullscreen — hides everything but the diagram.",
        ],
      },
      {
        kind: "p",
        text: "While the board is locked for presenting, the menu swaps to a compact set: Unlock, Fullscreen and Fit view.",
      },
      {
        kind: "tip",
        text: "On laptops with gesture trackpads, a two-finger tap IS a right-click — so the very same gesture works almost everywhere.",
      },
    ],
  },
  {
    id: "workspace",
    title: "Know your workspace",
    icon: Map,
    blocks: [
      {
        kind: "p",
        text: "Everything you see on the canvas is called an element (shapes, icons, text, tables, code snippets). The lines between elements are called connections.",
      },
      {
        kind: "list",
        items: [
          "Left tool rail — add shapes, icons, text, tables and code, plus zoom, fit-view and undo/redo.",
          "Bottom style bar — appears whenever something is selected; change colors, borders, text and rotation there.",
          "Top-left corner — fullscreen, light/dark theme and the canvas background (plain, grid or dots).",
          "Top-right corner — Clear board, Import, Export and this Help guide.",
          "Bottom-left corner — the lock button that freezes the board for presenting.",
        ],
      },
      {
        kind: "figure",
        figure: "workspace",
        caption: "The whole workspace in one picture: tool rail, canvas, style bar, corner controls and the lock button.",
      },
      {
        kind: "tip",
        text: "Everything auto-saves in your browser. Close the tab, come back later, and your board is exactly where you left it.",
      },
    ],
  },
  {
    id: "add-elements",
    title: "Add elements",
    icon: Shapes,
    blocks: [
      {
        kind: "p",
        text: "The left tool rail is your toolbox. Each button adds a different kind of element to the center of your view.",
      },
      {
        kind: "steps",
        items: [
          "Pick a tool: Rectangle, Ellipse, Line, Tag, Text, Table or Code snippet.",
          "For Rectangle and Ellipse, drag on the canvas to draw the size you want.",
          "For Text, Table, Code snippet and Tag, just click the button — the element is placed in the middle of the screen.",
          "Double-click empty canvas to instantly drop a text box.",
          "Double-click any element to edit its label — type, then click away or press Escape to finish.",
        ],
      },
      {
        kind: "figure",
        figure: "add-elements",
        caption: "Pick a tool from the rail — drag on the canvas for shapes, or click once for text, tables and code.",
      },
      {
        kind: "list",
        items: [
          "Tag — small pill labels, perfect for things like “prod”, “staging” or “v2”.",
          "Table — an editable grid; double-click any cell to type.",
          "Code snippet — a file card with syntax highlighting for sharing code inside the diagram.",
        ],
      },
      {
        kind: "tip",
        text: "Hold the Select tool (arrow) and drag on empty canvas to draw a selection box around several elements at once.",
      },
    ],
  },
  {
    id: "icons",
    title: "Add icons from the library",
    icon: ImageIcon,
    blocks: [
      {
        kind: "p",
        text: "The icon library ships 250+ ready-made icons — AWS services, databases, browsers, frameworks, programming languages, operating systems, file types and more.",
      },
      {
        kind: "steps",
        items: [
          "Click the Add icon button at the top of the left tool rail.",
          "Search by name, or tap a category chip (AWS, Database, Browser, Framework…) to browse.",
          "Click an icon to select it — a live preview shows exactly how it will land.",
          "Pick a style: Icon only (a clean 96 × 96 icon), Icon + text (classic label underneath) or Icon frame (an app-window card with a title).",
          "Press Add to board — the icon appears at the center of your view, ready to connect.",
        ],
      },
      {
        kind: "figure",
        figure: "icons",
        caption: "Icon styles side by side — the Icon frame option gives services a tidy app-window card with a title.",
      },
      {
        kind: "tip",
        text: "Icon frames look great for cloud services; keep bare icons for small inner details. You can resize any icon later by dragging its handles.",
      },
    ],
  },
  {
    id: "connect",
    title: "Connect elements",
    icon: Spline,
    blocks: [
      {
        kind: "p",
        text: "Connections are the arrows that show how things talk to each other. They are “smart” — they bend around other elements instead of crossing over them.",
      },
      {
        kind: "steps",
        items: [
          "Hover over an element until small round handles appear on its border.",
          "Press a handle and drag toward another element — a preview line follows you.",
          "Release over the target element. Done — the connection snaps in with an arrow.",
          "Move either element any time: the line re-routes itself automatically.",
        ],
      },
      {
        kind: "figure",
        figure: "connect",
        caption: "Drag from a round handle — the smart line bends around obstacles and snaps onto the target element.",
      },
      { kind: "p", text: "To remove a connection, click the line to select it and press Delete (or Backspace)." },
      {
        kind: "tip",
        text: "Turn on Animate in the Edge panel (bottom bar, when a line is selected) to make the dashes flow — perfect for showing data direction.",
      },
    ],
  },
  {
    id: "style-elements",
    title: "Style your elements",
    icon: Palette,
    blocks: [
      {
        kind: "p",
        text: "Select any element and the style bar appears at the bottom of the screen. Every panel works on whatever is selected.",
      },
      {
        kind: "list",
        items: [
          "Shapes — swap the element between rectangle, ellipse, triangle, diamond and hexagon without redrawing it.",
          "BG — fill color with quick swatches, a “no color” option and an opacity slider.",
          "Border — solid or dashed, six colors, width from 1 to 5 px.",
          "T — text size from 8 to 28 px.",
          "Aa — typography: text color, bold / normal and left / center / right alignment.",
          "Rotate — a slider plus quick +15°, +45°, +90° buttons, a number box and a reset to 0°.",
        ],
      },
      {
        kind: "figure",
        figure: "style-elements",
        caption: "The style bar in action: shapes, background colors, borders, text size, typography and rotation.",
      },
      {
        kind: "tip",
        text: "Want the same look in several places? Copy an element (Ctrl/Cmd + C) and paste it (Ctrl/Cmd + V) — colors, borders and text styling all come along.",
      },
    ],
  },
  {
    id: "style-connections",
    title: "Style connections",
    icon: Waypoints,
    blocks: [
      {
        kind: "p",
        text: "Click a connection line and the Edge panel opens in the bottom bar.",
      },
      {
        kind: "list",
        items: [
          "Style — solid for plain links, dashed for async or optional flows.",
          "Color — six quick swatches to match your legend.",
          "Width — 1 to 5 px, thicker means more important.",
          "Animate — On makes the dashes travel along the line, a lovely “data is flowing” effect.",
        ],
      },
      {
        kind: "figure",
        figure: "style-connections",
        caption: "Three ways to draw a link: solid, dashed with flowing animation, or thick and colored for emphasis.",
      },
      {
        kind: "tip",
        text: "Exports keep the look: PNG captures the dashes exactly as you see them, and exported SVG files even keep the flowing animation when opened in a browser.",
      },
    ],
  },
  {
    id: "edit",
    title: "Select, move, copy & delete",
    icon: MousePointerClick,
    blocks: [
      {
        kind: "p",
        text: "Everyday editing works the way you expect from any drawing app — with a few smart extras.",
      },
      {
        kind: "list",
        items: [
          "Select — click an element; Shift-click to add more; drag on empty canvas with the Select tool for a box selection.",
          "Move — drag selected elements. Teal smart guides appear to help you line things up with neighbors.",
          "Resize — drag the handles around a selected element.",
          "Copy & paste — Ctrl/Cmd + C then Ctrl/Cmd + V. Groups keep their internal connections; each paste lands slightly offset.",
          "Delete — select and press Delete or Backspace. Deleting an element also removes its lines.",
          "Undo & redo — Ctrl/Cmd + Z to undo, Ctrl/Cmd + Shift + Z (or Ctrl/Cmd + Y) to redo, or use the arrows at the bottom of the left rail. Up to 100 steps are kept.",
        ],
      },
      {
        kind: "figure",
        figure: "edit",
        caption: "Box-select several elements at once and drag them together — teal smart guides keep everything aligned.",
      },
      {
        kind: "tip",
        text: "Made a big mistake? The Clear button (top-right) wipes the board but undo brings everything back.",
      },
    ],
  },
  {
    id: "view",
    title: "Zoom, pan & fullscreen",
    icon: Eye,
    blocks: [
      {
        kind: "p",
        text: "Getting around the canvas is quick, whether you use the mouse, the trackpad or touch.",
      },
      {
        kind: "list",
        items: [
          "Zoom — scroll wheel or pinch, or the magnifier buttons in the left rail.",
          "Fit view — the frame button in the left rail (also in the radial menu) frames your whole diagram perfectly.",
          "Pan — switch to the Hand tool and drag the canvas anywhere.",
          "Fullscreen — the expand button in the top-left corner hides everything but your diagram; press Esc to leave.",
          "Theme — the sun / moon button switches light and dark; exports follow the active theme.",
          "Background — the pattern button cycles plain → grid → dots.",
        ],
      },
      {
        kind: "figure",
        figure: "view",
        caption: "Zoom pill, fit view, hand panning, fullscreen brackets and the plain / grid / dots background switch.",
      },
    ],
  },
  {
    id: "lock",
    title: "Lock the board (present mode)",
    icon: Lock,
    blocks: [
      {
        kind: "p",
        text: "Locking turns the board into a safe, view-only presentation — nothing can be moved, edited or deleted by accident.",
      },
      {
        kind: "steps",
        items: [
          "Click the open-lock button in the bottom-left corner.",
          "The editing tools fade away and the board freezes; you can still pan, zoom and use fullscreen.",
          "Tap any element to highlight it while you talk through your diagram.",
          "Click the same button (now a closed lock) — or Unlock in the radial menu — to start editing again.",
        ],
      },
      {
        kind: "figure",
        figure: "lock",
        caption: "Locked board: elements dim, a padlock badge appears, and tapped elements get a teal highlight ring.",
      },
      {
        kind: "tip",
        text: "Lock + Fullscreen is the perfect combo for screen-sharing in meetings.",
      },
    ],
  },
  {
    id: "import-export",
    title: "Import & export",
    icon: Download,
    blocks: [
      {
        kind: "p",
        text: "The Export button (top-right) saves your diagram in three formats, each with a different superpower.",
      },
      {
        kind: "figure",
        figure: "import-export",
        caption: "JSON in, PNG & SVG out — the whole board round-trips through files.",
      },
      {
        kind: "list",
        items: [
          "PNG — a ready-to-share image for docs, chats and slides.",
          "SVG — a crisp vector image that scales forever; dashed “animated” edges even keep flowing when the file is opened in a browser.",
          "JSON — a full editable project file. Keep it as a backup or move diagrams between boards.",
        ],
      },
      {
        kind: "steps",
        items: [
          "Click Export in the top-right corner.",
          "Type a file name and pick the format.",
          "Hit Export — the download starts immediately.",
        ],
      },
      {
        kind: "p",
        text: "To bring a project back, click Import (next to Export) and either paste the JSON contents or pick the file — the whole board, connections and viewport included, is rebuilt for you.",
      },
      {
        kind: "tip",
        text: "Export the whole board with Fit view first so nothing is accidentally left outside the picture.",
      },
    ],
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    icon: Keyboard,
    blocks: [
      {
        kind: "p",
        text: "On a Mac, use ⌘ Cmd where the list says Ctrl. Shortcuts pause automatically while you are typing in a label or field.",
      },
      {
        kind: "shortcuts",
        rows: [
          { keys: ["Ctrl", "Z"], desc: "Undo the last change" },
          { keys: ["Ctrl", "Shift", "Z"], desc: "Redo" },
          { keys: ["Ctrl", "Y"], desc: "Redo (alternative)" },
          { keys: ["Ctrl", "C"], desc: "Copy the selection (groups keep their connections)" },
          { keys: ["Ctrl", "V"], desc: "Paste" },
          { keys: ["Delete"], desc: "Delete the selection (Backspace works too)" },
          { keys: ["Double-click"], desc: "New text box on empty canvas / edit an element's label" },
          { keys: ["Right-click"], desc: "Open the radial quick menu" },
          { keys: ["Two-finger tap"], desc: "Open the radial quick menu on touch screens" },
          { keys: ["F1"], desc: "Open this guide" },
        ],
      },
    ],
  },
  {
    id: "tips",
    title: "Tips & tricks",
    icon: Lightbulb,
    blocks: [
      {
        kind: "list",
        items: [
          "Use Icon frames for services and bare icons for inner details — instant visual hierarchy.",
          "Reserve animated dashed lines for data flow, and keep plain solid lines for simple links; the diagram becomes readable at a glance.",
          "Tags are perfect for environments: prod, staging, dev — color them with the style bar.",
          "Fit view before every export so the whole diagram is captured.",
          "Lock the board before presenting so a stray click can never move anything.",
          "Export important diagrams as JSON from time to time — it is the only format that re-opens fully editable.",
          "Dark theme exports on a black background, light theme on white — pick the one that suits where the image will land.",
        ],
      },
      {
        kind: "tip",
        text: "That is the whole tour — press F1 any time to come back to this guide. Happy diagramming!",
      },
    ],
  },
]

/** Plain-text projection of a block — used by the quick search. */
export function guideBlockText(block: GuideBlock): string {
  switch (block.kind) {
    case "p":
    case "tip":
      return block.text
    case "steps":
    case "list":
      return block.items.join(" ")
    case "shortcuts":
      return block.rows.map((r) => `${r.desc} ${r.keys.join(" ")}`).join(" ")
    case "figure":
      return block.caption
  }
}

/** Full searchable text of a section (title + every block). */
export function guideSectionText(section: GuideSection): string {
  return [section.title, ...section.blocks.map(guideBlockText)].join(" ")
}
