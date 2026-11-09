import Link from "next/link";
import { DM_Sans } from "next/font/google";
import { getSEOTags } from "@/libs/seo";
import { auth } from "@/libs/auth";
import config from "@/config";
import ButtonCheckout from "@/components/ButtonCheckout";

const display = DM_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata = getSEOTags({ canonicalUrlRelative: "/" });

const loginHref = "/login";

const FEATURE_CARDS = [
  {
    t: "One link",
    d: "A single public page for your availability. Share it once; reuse it every week.",
    bg: "linear-gradient(145deg, color-mix(in oklab, #8b5cf6 22%, var(--color-base-100)), var(--color-base-100))",
    border: "color-mix(in oklab, #8b5cf6 45%, var(--color-base-300))",
    bar: "#7c3aed",
  },
  {
    t: "Less coordination",
    d: "Stop trading messages to find a free hour. People book inside the windows you set.",
    bg: "linear-gradient(145deg, color-mix(in oklab, #0ea5e9 22%, var(--color-base-100)), var(--color-base-100))",
    border: "color-mix(in oklab, #0ea5e9 45%, var(--color-base-300))",
    bar: "#0284c7",
  },
  {
    t: "Calendar in sync",
    d: "Connect Google Calendar so busy time and new bookings stay aligned.",
    bg: "linear-gradient(145deg, color-mix(in oklab, #10b981 22%, var(--color-base-100)), var(--color-base-100))",
    border: "color-mix(in oklab, #10b981 45%, var(--color-base-300))",
    bar: "#059669",
  },
];

export default async function Landing() {
  const session = await auth();
  const plans = config.stripe.plans;

  return (
    <main className={`min-h-screen bg-base-100 text-base-content overflow-x-hidden ${display.className}`}>
      {/* Stronger top wash */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 640px 360px at -5% -10%, color-mix(in oklab, var(--color-primary) 28%, transparent), transparent 72%), radial-gradient(ellipse 560px 320px at 105% -5%, color-mix(in oklab, var(--color-secondary) 22%, transparent), transparent 70%), radial-gradient(ellipse 480px 280px at 50% 15%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 65%), radial-gradient(ellipse 400px 200px at 70% 40%, color-mix(in oklab, var(--color-secondary) 8%, transparent), transparent 70%)",
          backgroundRepeat: "no-repeat",
        }}
      />

      <header className="border-b border-base-300/50 bg-base-100/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={config.appName}
            className="h-12 sm:h-14 w-auto"
          />
          {session ? (
            <Link href="/dashboard" className="btn btn-primary btn-sm">
              Dashboard
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link href={loginHref} className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link href={loginHref} className="btn btn-primary btn-sm">
                Get started
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero — extra gradient band behind this block */}
      <section
        className="relative"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 80% at 20% 30%, color-mix(in oklab, var(--color-primary) 18%, transparent), transparent 60%), radial-gradient(ellipse 50% 60% at 90% 40%, color-mix(in oklab, var(--color-secondary) 16%, transparent), transparent 55%)",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-16 md:pt-20 md:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-14 items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-5">
                Scheduling for coaches &amp; individuals
              </p>
              <h1
                className="font-bold tracking-tight text-base-content leading-[1.08]"
                style={{
                  fontSize: "clamp(2.35rem, 5.2vw, 3.65rem)",
                  letterSpacing: "-0.03em",
                }}
              >
                Handle your day&apos;s schedule without the back-and-forth.
              </h1>
              <p className="mt-6 text-base md:text-lg text-base-content/60 max-w-md leading-relaxed font-medium">
                Share one link. Others pick a time you&apos;re free. You spend less
                time coordinating appointments and more time on the work itself.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href={loginHref} className="btn btn-primary btn-lg">
                  Get started free
                </Link>
                <a href="#how-it-works" className="btn btn-ghost btn-lg">
                  How it works
                </a>
              </div>
            </div>

            <div className="relative">
              <div
                className="absolute -inset-6 rounded-3xl opacity-70 blur-2xl -z-10"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 35%, transparent), color-mix(in oklab, var(--color-secondary) 28%, transparent))",
                }}
              />
              <div className="rounded-2xl border border-base-300/80 bg-base-100 shadow-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-base-300 bg-base-200/80">
                  <span className="size-2.5 rounded-full bg-base-content/15" />
                  <span className="size-2.5 rounded-full bg-base-content/15" />
                  <span className="size-2.5 rounded-full bg-base-content/15" />
                  <span className="ml-2 text-[11px] text-base-content/40 truncate">
                    calio.app/your-name
                  </span>
                </div>
                <div className="grid sm:grid-cols-[140px_1fr] gap-0">
                  <div className="p-4 border-b sm:border-b-0 sm:border-r border-base-300 bg-base-200/30">
                    <div className="flex sm:flex-col items-center sm:items-start gap-3">
                      <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        A
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Alex Chen</p>
                        <p className="text-[11px] text-base-content/50">
                          Coach · 1:1 sessions
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {["Coaching", "Online"].map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs font-medium text-base-content/50">
                      Select a meeting
                    </p>
                    <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                      <p className="text-sm font-semibold">30-min intro</p>
                      <p className="text-[11px] text-base-content/50">
                        30 min · Google Meet
                      </p>
                    </div>
                    <div className="rounded-xl border border-base-300 px-3 py-2.5 opacity-70">
                      <p className="text-sm font-medium">60-min session</p>
                      <p className="text-[11px] text-base-content/50">60 min</p>
                    </div>
                    <p className="text-xs font-medium text-base-content/50 pt-1">
                      Available times
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {["9:00", "9:30", "10:00", "11:00", "14:00", "15:30"].map(
                        (t, i) => (
                          <span
                            key={t}
                            className={`text-center text-[11px] py-1.5 rounded-lg border font-medium ${
                              i === 2
                                ? "border-primary bg-primary text-primary-content"
                                : "border-base-300 text-base-content/70"
                            }`}
                          >
                            {t}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-t border-base-300 px-4 py-3 bg-base-200/40">
                  <p className="text-[10px] uppercase tracking-wider text-base-content/40 mb-2">
                    This week
                  </p>
                  <div className="grid grid-cols-7 gap-1">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                      <div key={`${d}-${i}`} className="text-center">
                        <p className="text-[10px] text-base-content/40 mb-1">{d}</p>
                        <div
                          className={`h-8 rounded-md border ${
                            i === 2
                              ? "border-primary/40 bg-primary/15"
                              : i === 5 || i === 6
                                ? "border-base-300/50 bg-base-200"
                                : "border-base-300 bg-base-100"
                          }`}
                        >
                          {i === 2 ? (
                            <div className="mt-1 mx-auto w-3/4 h-2 rounded-sm bg-primary/50" />
                          ) : i === 1 || i === 3 ? (
                            <div className="mt-1.5 mx-auto w-2/3 h-1.5 rounded-sm bg-base-content/15" />
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-6">
        <div className="grid md:grid-cols-2 gap-5">
          <div
            className="rounded-2xl border p-6 shadow-sm"
            style={{
              background: "linear-gradient(145deg, color-mix(in oklab, #8b5cf6 20%, var(--color-base-100)), var(--color-base-100))",
              borderColor: "color-mix(in oklab, #8b5cf6 45%, var(--color-base-300))",
            }}
          >
            <h2 className="text-sm font-semibold tracking-wide uppercase text-base-content/50">
              For coaches &amp; consultants
            </h2>
            <p className="mt-3 text-base-content/70 leading-relaxed text-sm md:text-base">
              Publish a booking page, set weekly hours, and optionally use
              session packages so clients only book when they have remaining
              sessions.
            </p>
          </div>
          <div
            className="rounded-2xl border p-6 shadow-sm"
            style={{
              background: "linear-gradient(145deg, color-mix(in oklab, #0ea5e9 20%, var(--color-base-100)), var(--color-base-100))",
              borderColor: "color-mix(in oklab, #0ea5e9 45%, var(--color-base-300))",
            }}
          >
            <h2 className="text-sm font-semibold tracking-wide uppercase text-base-content/50">
              For personal use
            </h2>
            <p className="mt-3 text-base-content/70 leading-relaxed text-sm md:text-base">
              Share times you&apos;re free for meetings. The other person chooses
              a slot—no long chat threads to find a time that works.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-8">
          What you get
        </h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {FEATURE_CARDS.map((item) => (
            <div
              key={item.t}
              className="rounded-2xl p-5 shadow-sm border"
              style={{ background: item.bg, borderColor: item.border }}
            >
              <div
                className="h-1 w-12 rounded-full mb-4"
                style={{ background: item.bar }}
              />
              <h3 className="font-semibold">{item.t}</h3>
              <p className="mt-2 text-sm text-base-content/60 leading-relaxed">
                {item.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-20 border-y border-base-300/60"
        style={{
          background:
            "radial-gradient(ellipse 400px 180px at 10% 0%, color-mix(in oklab, var(--color-primary) 10%, transparent), transparent 70%)",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-14">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-2">
            How it works
          </h2>
          <p className="text-sm text-base-content/55 mb-10 max-w-lg">
            From sign-up to a live booking link in a few steps.
          </p>
          <ol className="grid sm:grid-cols-2 gap-5 max-w-3xl">
            {[
              {
                t: "Sign in and set weekly hours",
                d: "Mark the days and times you’re open. Only those windows appear to others.",
              },
              {
                t: "Create what people can book",
                d: "Meeting types with duration and location. Coaches can attach session packages when needed.",
              },
              {
                t: "Share your link",
                d: "Set a username in Settings and send your page. Visitors pick a time in their timezone.",
              },
              {
                t: "Manage from one workspace",
                d: "See bookings on the calendar, confirm or decline requests, and keep Google Calendar updated on Pro.",
              },
            ].map((s, i) => (
              <li
                key={s.t}
                className="rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm flex gap-3"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{s.t}</p>
                  <p className="mt-1 text-sm text-base-content/55 leading-relaxed">
                    {s.d}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="pricing" className="max-w-6xl mx-auto px-6 py-14 scroll-mt-20">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-2">
          Plans
        </h2>
        <p className="text-sm text-base-content/55 mb-10 max-w-lg">
          Start free. Upgrade when you need full Google Calendar sync and more
          event types.
        </p>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 flex flex-col shadow-sm ${
                plan.isFeatured
                  ? "border-primary/40 bg-primary/5"
                  : "border-base-300 bg-base-100/90"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                {plan.isFeatured ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Popular
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-base-content/55">{plan.description}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight">
                  {plan.price === 0 ? "Free" : `$${plan.price}`}
                </span>
                {plan.price !== 0 ? (
                  <span className="text-sm text-base-content/45">
                    {plan.billingPeriod || "/month"}
                  </span>
                ) : null}
                {plan.priceAnchor ? (
                  <span className="ml-2 text-sm text-base-content/35 line-through">
                    ${plan.priceAnchor}
                  </span>
                ) : null}
              </p>
              <ul className="mt-6 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f.name} className="text-sm text-base-content/70 flex gap-2">
                    <span className="text-primary shrink-0">✓</span>
                    <span>{f.name}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {plan.priceId ? (
                  <ButtonCheckout
                    priceId={plan.priceId}
                    mode={plan.mode || "subscription"}
                  />
                ) : (
                  <Link href={loginHref} className="btn btn-primary btn-block">
                    Get started free
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-base-300/60 bg-base-100/80">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-base-content/45">
          <span>
            © {new Date().getFullYear()} {config.appName}
          </span>
          <div className="flex gap-4">
            <Link href="/tos" className="hover:text-base-content">
              Terms
            </Link>
            <Link href="/privacy-policy" className="hover:text-base-content">
              Privacy
            </Link>
            <a href="#pricing" className="hover:text-base-content">
              Plans
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
