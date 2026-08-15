import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import { auth } from "@/libs/auth";
import config from "@/config";
import FeedbackForm from "@/components/FeedbackForm";

export const metadata = getSEOTags({ canonicalUrlRelative: "/" });

export default async function Landing() {
  const session = await auth();

  return (
    <main className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt={config.appName} className="h-10 w-auto" />

        {session ? (
          <Link href="/dashboard" className="btn btn-primary btn-sm">
            Dashboard
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/api/auth/signin" className="btn btn-ghost btn-sm">
              Log in
            </Link>
            <Link href="/api/auth/signin" className="btn btn-primary btn-sm">
              Sign up
            </Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-8 md:pt-16 pb-16 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-7">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary/80 border border-primary/30 rounded-full px-3 py-1">
            For coaches & trainers
          </span>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight">
            Booking + session
            <br />
            packages in one place
          </h1>

          <p className="text-lg text-base-content/70 max-w-md">
            Share one link. Clients enter their email, pick a timezone, and only
            see courses they can book—with remaining sessions counted so nothing
            gets overbooked.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/api/auth/signin" className="btn btn-primary btn-lg">
              Get started free
            </Link>
            <a href="#how-it-works" className="btn btn-ghost btn-lg">
              How it works
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-base-content/60">
            <span>✓ Session packages</span>
            <span>✓ Timezone-safe booking</span>
            <span>✓ Email confirmations</span>
          </div>
        </div>

        {/* Right: simple product mock */}
        <div className="relative">
          <div className="rounded-2xl border border-base-300 bg-base-200 shadow-xl overflow-hidden">
            <div className="h-1.5 bg-primary" />
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  C
                </div>
                <div>
                  <p className="font-bold">Your coaching page</p>
                  <p className="text-xs text-base-content/50">
                    calio.app/your-name
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-base-100 border border-base-300 p-4 space-y-2 text-sm">
                <p className="text-xs font-semibold text-base-content/45 uppercase tracking-wide">
                  Client flow
                </p>
                <p>1. Enter email</p>
                <p>2. Choose timezone</p>
                <p>3. See available courses & sessions left</p>
                <p>4. Pick a time → confirmed</p>
              </div>
              <div className="rounded-xl bg-success/10 border border-success/25 px-4 py-3 text-sm text-success font-medium">
                2 sessions available · package course
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-base-300">
        <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-4">
          Built for real coaching workflows
        </h2>
        <p className="text-center text-base-content/60 max-w-2xl mx-auto mb-12 text-sm md:text-base">
          Not just another calendar link. Calio ties availability, session
          packages, and booking into one flow you can hand to clients.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="space-y-2 rounded-2xl border border-base-300 bg-base-200/50 p-6">
            <h3 className="font-bold text-lg">Session packages</h3>
            <p className="text-sm text-base-content/60 leading-relaxed">
              Activate a package by client email and session count. Remaining
              sessions update as they book; upcoming bookings are reserved so
              clients can&apos;t overbook.
            </p>
          </div>
          <div className="space-y-2 rounded-2xl border border-base-300 bg-base-200/50 p-6">
            <h3 className="font-bold text-lg">Smart booking page</h3>
            <p className="text-sm text-base-content/60 leading-relaxed">
              Clients identify with email, set their timezone, then only see
              package courses they still have sessions for—plus any open courses
              you offer without a package.
            </p>
          </div>
          <div className="space-y-2 rounded-2xl border border-base-300 bg-base-200/50 p-6">
            <h3 className="font-bold text-lg">Calendar & email</h3>
            <p className="text-sm text-base-content/60 leading-relaxed">
              Set weekly availability, buffers, and approval rules. Confirmations,
              reminders, reschedule and cancel links go out by email
              automatically.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="scroll-mt-24 max-w-6xl mx-auto px-6 py-16 border-t border-base-300"
      >
        <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-4">
          How to use Calio
        </h2>
        <p className="text-center text-base-content/60 max-w-xl mx-auto mb-12 text-sm">
          From zero to a live booking page in a few steps.
        </p>
        <ol className="max-w-2xl mx-auto space-y-6">
          {[
            {
              t: "Sign up and set availability",
              d: "Choose the days and hours you’re open. That controls which slots clients can request.",
            },
            {
              t: "Create courses (event types)",
              d: "Name, duration, optional price and description. Turn on “requires session package” for paid package courses.",
            },
            {
              t: "Activate session packages",
              d: "In Packages, pick a course, enter client emails, and set how many sessions each person gets.",
            },
            {
              t: "Share your link",
              d: "In Settings, set a username. Send calio.app/your-name (or your domain) to clients.",
            },
            {
              t: "Clients book; you manage",
              d: "They enter email → timezone → course → time. You review in Bookings / Calendar. Sessions deduct after class starts.",
            },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-4">
              <span className="w-8 h-8 rounded-full bg-primary text-primary-content text-sm font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{s.t}</p>
                <p className="text-sm text-base-content/60 mt-1 leading-relaxed">
                  {s.d}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="text-center mt-12">
          <Link href="/api/auth/signin" className="btn btn-primary btn-lg">
            Create your booking page
          </Link>
        </div>
      </section>

      <section className="max-w-lg mx-auto px-6 pb-20">
        <FeedbackForm />
      </section>
    </main>
  );
}
