import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import { auth } from "@/libs/auth";
import config from "@/config";

export const metadata = getSEOTags({ canonicalUrlRelative: "/" });

export default async function Landing() {
  const session = await auth();

  return (
    <main className="min-h-screen">
      {/* Top nav */}
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
        {/* Left: headline */}
        <div className="space-y-7">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary/80 border border-primary/30 rounded-full px-3 py-1">
            Calendar × Auto Emails
          </span>

          <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.1] tracking-tight">
            Schedule it.
            <br />
            We&apos;ll send
            <br />
            the emails.
          </h1>

          <p className="text-lg text-base-content/70 max-w-md">
            Create an event and invites, confirmations, and meeting links go out automatically. No more chasing people one email at a time.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/dashboard/events/new" className="btn btn-primary btn-lg">
              Create an event
            </Link>
            <a href="#features" className="btn btn-ghost btn-lg">
              See how it works
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-base-content/60">
            <span>✓ Automatic emails</span>
            <span>✓ One-click sharing</span>
            <span>✓ Team meeting links</span>
          </div>
        </div>

        {/* Right: signature visual — mock event card */}
        <div className="relative">
          <div className="rounded-2xl border border-base-300 bg-base-200 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-base-300 bg-base-300/40">
              <span className="w-2.5 h-2.5 rounded-full bg-error/60"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-warning/60"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-success/60"></span>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-base-content/60">
                  Today · 2:00 - 2:30 PM
                </span>
                <span className="badge badge-primary badge-sm">Scheduled</span>
              </div>

              <h3 className="text-xl font-bold">Product Weekly</h3>
              <p className="text-sm text-base-content/60">With 4 team members</p>

              <div className="divider my-2"></div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0"></span>
                  <span>Invites sent to 4 participants</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-base-content/60">
                  <span className="w-2 h-2 rounded-full bg-base-content/30 shrink-0"></span>
                  <span>Meeting link attached automatically</span>
                </div>
              </div>
            </div>
          </div>

          {/* floating badge */}
          <div className="absolute -bottom-5 -left-5 bg-base-100 border border-base-300 rounded-xl shadow-lg px-4 py-3 hidden sm:block">
            <p className="text-xs text-base-content/50">Confirmed</p>
            <p className="text-lg font-bold">3 / 4</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-24 max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-10">
        <div className="space-y-2">
          <h3 className="font-bold text-lg">Automatic notifications</h3>
          <p className="text-sm text-base-content/60">
            The moment an event is created, every participant gets an invite. No manual follow-ups.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-lg">Share with one link</h3>
          <p className="text-sm text-base-content/60">
            Send a link, they confirm attendance. No account needed on their end.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-lg">Team meeting links</h3>
          <p className="text-sm text-base-content/60">
            Meetings come with a video call link attached automatically, so everyone gets the same one.
          </p>
        </div>
      </section>
    </main>
  );
}
