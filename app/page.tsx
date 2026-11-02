"use client"

import dynamic from "next/dynamic"
const DesignBoard = dynamic(() => import("@/components/board/design-board"), { ssr: false })
export default function Page() {
  return (
    <main
      className="h-[100dvh] min-h-0 w-full flex flex-col overflow-hidden"
      // Canvas follows the theme: white in light, black in dark (see --af-board-bg)
      style={{ background: "var(--af-board-bg)", color: "var(--af-node-text)" }}
    >
      <div className="sr-only">
        <h1>Atom Flow — Free Online Architecture Diagram Tool</h1>
        <p>Draw app, network and cloud architecture diagrams in your browser: drag-and-drop shapes, 250+ built-in cloud icons including AWS, smart self-routing connections, PNG / SVG / JSON export, present mode — free and without sign-up.</p>
      </div>
      <DesignBoard />
    </main>
  )
}
