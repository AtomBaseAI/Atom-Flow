"use client"

import dynamic from "next/dynamic"
const DesignBoard = dynamic(() => import("@/components/board/design-board"), { ssr: false })
export default function Page() {
  return (
    <main className="h-[100dvh] min-h-0 w-full bg-black text-white flex flex-col overflow-hidden">
      <DesignBoard />
    </main>
  )
}