'use client'

import { Navbar } from "@/components/Navbar"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { auth } from '@/firebaseConfig'

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user)
    })
    return () => unsubscribe()
  }, [])

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-32 px-4">
          <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[size:20px_20px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
          
          <div className="relative max-w-7xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium mb-8 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              The easiest way to split tabs and get paid
            </div>
            
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-slide-up">
              Split Tabs.<br />
              Track Payments.<br />
              <span className="text-slate-900">Get Paid.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-delay">
              It&apos;s like Spotify Wrapped, except it&apos;s the tab you and your friends ran up, 
              and now you&apos;re even more broke. Wrapped.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-delay-2">
              {isLoggedIn ? (
                <>
                  <Link href="/tabs/new">
                    <Button size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/50">
                      Create New Tab
                    </Button>
                  </Link>
                  <Link href="/tabs">
                    <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-2">
                      View My Tabs
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/50">
                      Get Started Free
                    </Button>
                  </Link>
                  <Link href="/tabs">
                    <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-2">
                      View Demo
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 px-4 bg-white/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                Everything you need to split tabs like a pro
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Powerful features that make splitting bills and tracking payments effortless
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1: Create & Split */}
              <div className="group p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">Create & Split Tabs</h3>
                <p className="text-slate-600 leading-relaxed">
                  Create tabs with multiple people and items. Split expenses any way you want - equal splits, custom amounts, or percentages. 
                  Add items on the fly and watch totals calculate automatically.
                </p>
              </div>

              {/* Feature 2: Venmo Integration */}
              <div className="group p-8 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">Automatic Venmo Tracking</h3>
                <p className="text-slate-600 leading-relaxed">
                  Forward Venmo payment emails to automatically track who&apos;s paid. Our smart parser extracts payment details 
                  and marks people as paid automatically. No manual tracking needed!
                </p>
              </div>

              {/* Feature 3: Payment Requests */}
              <div className="group p-8 rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">One-Click Payment Requests</h3>
                <p className="text-slate-600 leading-relaxed">
                  Send Venmo payment requests with a single click. Deep links work on mobile and web, 
                  making it super easy for friends to pay you back instantly.
                </p>
              </div>

              {/* Feature 4: Shareable Tabs */}
              <div className="group p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">Shareable Tab Links</h3>
                <p className="text-slate-600 leading-relaxed">
                  Share tabs with unique URLs. Friends can view their expenses, see what they owe, 
                  and mark themselves as paid - all without creating an account.
                </p>
              </div>

              {/* Feature 5: Real-time Tracking */}
              <div className="group p-8 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">Real-time Payment Status</h3>
                <p className="text-slate-600 leading-relaxed">
                  See who&apos;s paid and who hasn&apos;t at a glance. Color-coded status indicators make it 
                  easy to track payment progress. Get notified when payments come through.
                </p>
              </div>

              {/* Feature 6: Draft Saving */}
              <div className="group p-8 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">Auto-Save Drafts</h3>
                <p className="text-slate-600 leading-relaxed">
                  Never lose your work. Tabs are automatically saved as drafts while you&apos;re creating them. 
                  Come back anytime to finish and finalize your tab.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 px-4 bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
              <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                Get started in minutes. Split tabs, track payments, and get paid back - all in one place.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Step 1 */}
              <div className="relative">
                <div className="absolute -left-4 top-12 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg hidden md:flex">
                  1
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Create Your Tab</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Add people, items, and split expenses however you want. Custom splits, equal splits, or percentages - you decide.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="absolute -left-4 top-12 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg hidden md:flex">
                  2
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Share & Request</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Share the tab link with friends. Send Venmo payment requests with one click. Forward Venmo emails for automatic tracking.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="absolute -left-4 top-12 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg hidden md:flex">
                  3
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Get Paid</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Watch payments come in automatically. See who&apos;s paid and who hasn&apos;t. No more awkward follow-ups needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 bg-slate-900 text-slate-400">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-lg font-semibold text-white mb-2">TabWrapped</p>
            <p className="text-sm">The easiest way to split tabs and get paid. Made with ❤️ for broke friends everywhere.</p>
          </div>
        </footer>
      </main>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-fade-in-delay {
          animation: fade-in 0.8s ease-out 0.2s both;
        }

        .animate-fade-in-delay-2 {
          animation: fade-in 1s ease-out 0.4s both;
        }

        .animate-slide-up {
          animation: slide-up 0.8s ease-out;
        }

        .bg-grid-slate-900\/\[0\.04\] {
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
      `}</style>
    </>
  )
}
