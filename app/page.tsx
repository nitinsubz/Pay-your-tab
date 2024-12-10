'use client'

import { Navbar } from "@/components/Navbar"

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="text-4xl font-bold mb-2">The easiest way to get your tab paid.</h1>
      <p className="text-sm italic text-gray-600 mb-8">
        It&apos;s like spotify wrapped, except it&apos;s the tab you and our broke ass friends ran up and now y&apos;re even more broke, wrapped.
      </p>
      </main>
    </>
  )
}

