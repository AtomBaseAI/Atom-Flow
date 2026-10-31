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
      <DesignBoard />
    </main>
  )
}
