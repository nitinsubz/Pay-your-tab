'use client'

import { Navbar } from "@/components/Navbar"
import Link from "next/link"
import { useEffect, useState } from "react"
import { auth } from '@/firebaseConfig'
import {
  ArrowRight,
  Check,
  Link2,
  MailCheck,
  Plane,
  Receipt,
  Send,
  SlidersHorizontal,
  Users,
} from "lucide-react"

/* ---------------------------------------------------------------- pieces */

function Avatar({ name, tone }: { name: string; tone: string }) {
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${tone}`}
    >
      {name[0]}
    </span>
  )
}

/** A miniature of a real tab — the product, not a description of it. */
function TabPreview() {
  const people = [
    { name: 'Nitin', amount: '61.40', tone: 'bg-indigo-50 text-indigo-600', paid: true },
    { name: 'Maya', amount: '48.15', tone: 'bg-emerald-50 text-emerald-600', paid: true },
    { name: 'Dev', amount: '46.05', tone: 'bg-amber-50 text-amber-600', paid: false },
    { name: 'Sam', amount: '28.60', tone: 'bg-rose-50 text-rose-600', paid: false },
  ]

  return (
    <div className="relative">
      {/* soft brand glow behind the card */}
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-indigo-200/40 via-purple-200/30 to-pink-200/30 blur-3xl"
      />

      <div className="relative rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_16px_50px_-24px_rgba(15,23,42,0.35)] sm:p-6">
        {/* card header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="min-w-0">
            <p className="mb-0.5 text-xs font-medium uppercase tracking-widest text-gray-300">Friday</p>
            <h3 className="truncate text-[17px] font-semibold tracking-tight text-gray-900">
              Kang Ho Dong Baekjeong
            </h3>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-widest text-gray-300">Total</p>
            <p className="text-[17px] font-semibold tabular-nums tracking-tight text-gray-900">$184.20</p>
          </div>
        </div>

        {/* items */}
        <div className="space-y-2.5 py-4">
          {[
            { item: 'Galbi (2)', split: 'Nitin, Maya, Dev', amount: '78.00' },
            { item: 'Soju tower', split: 'everyone', amount: '42.00' },
            { item: 'Sam’s bibimbap', split: 'Sam', amount: '19.00' },
          ].map((row) => (
            <div key={row.item} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{row.item}</p>
                <p className="truncate text-xs text-gray-400">split · {row.split}</p>
              </div>
              <span className="shrink-0 tabular-nums text-gray-500">${row.amount}</span>
            </div>
          ))}
        </div>

        {/* who owes what */}
        <div className="space-y-1.5 border-t border-gray-100 pt-4">
          {people.map((person) => (
            <div key={person.name} className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
              <Avatar name={person.name} tone={person.tone} />
              <span className="flex-1 truncate text-sm font-medium text-gray-900">{person.name}</span>
              <span className="tabular-nums text-sm text-gray-500">${person.amount}</span>
              {person.paid ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                  <Check className="h-3 w-3" strokeWidth={3} />
                  paid
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
                  unpaid
                </span>
              )}
            </div>
          ))}
        </div>

        {/* progress + action */}
        <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-4">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div className="tw-fill h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          </div>
          <span className="shrink-0 text-xs font-medium text-gray-400">2 of 4 settled</span>
        </div>
      </div>

      {/* floating notification, hinting at automatic Venmo tracking */}
      <div className="tw-float absolute -bottom-7 -left-8 hidden items-center gap-2.5 rounded-2xl border border-gray-100 bg-white px-3.5 py-2.5 shadow-[0_12px_32px_-16px_rgba(15,23,42,0.4)] sm:flex lg:-left-14">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50">
          <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
        </span>
        <div className="leading-tight">
          <p className="text-[13px] font-medium text-gray-900">Maya paid you $48.15</p>
          <p className="text-[11px] text-gray-400">marked paid automatically</p>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  children,
  className = '',
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`group rounded-3xl border border-gray-100 bg-white p-6 transition-colors hover:border-gray-200 ${className}`}
    >
      <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white transition-colors group-hover:bg-indigo-600">
        {icon}
      </span>
      <h3 className="mb-2 text-[17px] font-semibold tracking-tight text-gray-900">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-500">{children}</p>
    </div>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-900">
        {n}
      </span>
      <h3 className="mb-2 text-lg font-semibold tracking-tight text-gray-900">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-500">{children}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ page */

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user)
    })
    return () => unsubscribe()
  }, [])

  const primaryCta = isLoggedIn
    ? { href: '/tabs/new', label: 'Create a tab' }
    : { href: '/login', label: 'Start a tab — free' }
  const secondaryCta = isLoggedIn
    ? { href: '/tabs', label: 'My tabs' }
    : { href: '#how-it-works', label: 'See how it works' }

  return (
    // globals.css sets Arial on body; the landing page opts into the Geist face
    // that layout.tsx already loads (nav included, so nothing mismatches on screen).
    <div className="font-[family-name:var(--font-geist-sans)]">
      <Navbar />

      <main className="min-h-screen bg-[#F7F7F8]">
        {/* ------------------------------------------------------- hero */}
        <section className="relative overflow-hidden px-4 pb-20 pt-14 sm:pt-20">
          {/* decorative layers paint above the page background, below the content */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[38rem] w-[64rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 opacity-70 blur-3xl"
          />
          <div aria-hidden className="tw-grid pointer-events-none absolute inset-0" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
            <div className="tw-rise text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/70 px-3 py-1.5 text-[13px] font-medium text-gray-600 backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="tw-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
                </span>
                Split the tab. Keep the friends.
              </span>

              <h1 className="mt-6 text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.035em] text-gray-900 sm:text-6xl lg:text-[4.25rem]">
                Everyone ate.
                <br />
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Everyone pays.
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-gray-500 lg:mx-0 sm:text-lg">
                TabWrapped splits the check line by line, sends the Venmo requests for you, and
                quietly ticks people off as they pay. It&apos;s like Spotify Wrapped, except it&apos;s
                the tab your broke ass ran up.
              </p>

              <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start justify-center">
                <Link
                  href={primaryCta.href}
                  className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gray-900 px-7 text-[15px] font-medium text-white transition-colors hover:bg-gray-800 sm:w-auto"
                >
                  {primaryCta.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href={secondaryCta.href}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full border border-gray-200 bg-white px-7 text-[15px] font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900 sm:w-auto"
                >
                  {secondaryCta.label}
                </Link>
              </div>

              <p className="mt-5 text-[13px] text-gray-400">
                Free · sign in with Google · friends don&apos;t need an account
              </p>
            </div>

            <div className="tw-rise tw-delay-2 mx-auto w-full max-w-sm lg:max-w-none">
              <TabPreview />
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- features */}
        <section className="px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                What you get
              </p>
              <h2 className="text-3xl font-semibold tracking-[-0.02em] text-gray-900 sm:text-4xl">
                The boring parts, handled.
              </h2>
              <p className="mt-4 text-[17px] leading-relaxed text-gray-500">
                No spreadsheets, no group-chat math, no &quot;hey, sorry to be that guy&quot; texts three
                weeks later.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard icon={<SlidersHorizontal className="h-5 w-5" />} title="Split it exactly right">
                Assign items to whoever ordered them, split the shared stuff evenly, and let tax and
                tip land proportionally. Totals recalculate as you type.
              </FeatureCard>

              <FeatureCard icon={<Send className="h-5 w-5" />} title="One-tap Venmo requests">
                Every person gets a prefilled Venmo deep link with their exact amount and the tab
                name. Works on mobile and web.
              </FeatureCard>

              <FeatureCard icon={<MailCheck className="h-5 w-5" />} title="Payments mark themselves">
                Forward your Venmo payment emails and TabWrapped reads them, matches the amount, and
                checks that person off. You stop chasing.
              </FeatureCard>

              <FeatureCard icon={<Link2 className="h-5 w-5" />} title="A link anyone can open">
                Share one URL and friends see their own line items and what they owe — no signup, no
                app, no login wall.
              </FeatureCard>

              <FeatureCard icon={<Plane className="h-5 w-5" />} title="Trips, not just dinners">
                Stack a whole weekend of bills into one tab — meals, gas, the Airbnb — and settle up
                with the fewest possible payments at the end.
              </FeatureCard>

              <FeatureCard icon={<Users className="h-5 w-5" />} title="See who still owes">
                Paid and unpaid at a glance across every tab, with an invite code so friends can add
                the expenses they covered themselves.
              </FeatureCard>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ how it works */}
        <section id="how-it-works" className="scroll-mt-16 border-y border-gray-100 bg-white px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                How it works
              </p>
              <h2 className="text-3xl font-semibold tracking-[-0.02em] text-gray-900 sm:text-4xl">
                Receipt to reimbursed, in three moves.
              </h2>
            </div>

            <div className="relative grid gap-12 md:grid-cols-3 md:gap-10">
              <div
                aria-hidden
                className="absolute left-0 right-0 top-[18px] hidden h-px bg-gradient-to-r from-gray-200 via-gray-200 to-transparent md:block"
              />
              <Step n="1" title="Build the tab">
                Punch in the items, add the people, and tap to say who had what. Drafts save
                themselves, so you can do it at the table or in the Uber home.
              </Step>
              <Step n="2" title="Send it out">
                Share the link or fire off Venmo requests in one tap. Everyone sees their own share,
                itemized, with nothing to install.
              </Step>
              <Step n="3" title="Watch it close out">
                Payments check themselves off as they land. When the last one clears, the tab is
                done — and so are you.
              </Step>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- cta band */}
        <section className="px-4 py-20 sm:py-24">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gray-900 px-6 py-16 text-center sm:px-12 sm:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-30 blur-3xl"
            />
            <div className="relative">
              <Receipt className="mx-auto mb-6 h-8 w-8 text-white/40" strokeWidth={1.5} />
              <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
                Stop fronting the bill and hoping for the best.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-gray-400">
                Put in one tab tonight and never send another &quot;did you Venmo me?&quot; text again.
              </p>
              <Link
                href={primaryCta.href}
                className="group mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-8 text-[15px] font-medium text-gray-900 transition-colors hover:bg-gray-100"
              >
                {primaryCta.label}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- footer */}
        <footer className="border-t border-gray-100 px-4 py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="text-[15px] font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Tab
              </span>
              <span className="text-gray-900">Wrapped</span>
            </span>
            <p className="text-sm text-gray-400">
              made with 💖 by{' '}
              <a
                href="https://www.linkedin.com/in/nitinsub/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 underline underline-offset-2 transition-colors hover:text-gray-900"
              >
                nitin subramanian
              </a>
            </p>
          </div>
        </footer>
      </main>

      <style jsx global>{`
        .tw-grid {
          background-image:
            linear-gradient(to right, rgba(15, 23, 42, 0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 23, 42, 0.07) 1px, transparent 1px);
          background-size: 48px 48px;
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%);
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%);
        }

        @keyframes tw-rise {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes tw-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-7px);
          }
        }
        @keyframes tw-ping {
          75%,
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
        @keyframes tw-fill {
          from {
            width: 0%;
          }
          to {
            width: 50%;
          }
        }

        .tw-rise {
          animation: tw-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .tw-delay-2 {
          animation-delay: 0.15s;
        }
        .tw-float {
          animation: tw-float 4.5s ease-in-out 1s infinite;
        }
        .tw-ping {
          animation: tw-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .tw-fill {
          animation: tw-fill 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;
        }

        @media (prefers-reduced-motion: reduce) {
          .tw-rise,
          .tw-float,
          .tw-ping,
          .tw-fill {
            animation: none;
          }
          .tw-fill {
            width: 50%;
          }
        }
      `}</style>
    </div>
  )
}
