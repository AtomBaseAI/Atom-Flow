import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Page not found",
}

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-4xl font-bold mb-4">Page not found</h1>
      <p className="text-lg mb-8">The page you're looking for doesn't exist.</p>
      <a href="/" className="text-teal-400 hover:text-teal-300 underline">
        Back to Atom Flow
      </a>
    </div>
  )
}
