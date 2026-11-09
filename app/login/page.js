"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import config from "@/config";

const FEATURES = [
  {
    title: "One booking link",
    body: "Share a single page. Clients pick a time that already matches your real availability.",
    // soft purple card
    bg: "linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)",
    border: "#c4b5fd",
    iconBg: "#8b5cf6",
  },
  {
    title: "Google Calendar sync",
    body: "Busy blocks and bookings stay in sync so you don’t double-book or chase emails.",
    bg: "linear-gradient(135deg, #e0f2fe 0%, #cffafe 100%)",
    border: "#7dd3fc",
    iconBg: "#0ea5e9",
  },
  {
    title: "Session packages",
    body: "Sell multi-session packages and let remaining credits gate what clients can book.",
    bg: "linear-gradient(135deg, #d1fae5 0%, #ccfbf1 100%)",
    border: "#6ee7b7",
    iconBg: "#10b981",
  },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-base-200">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt={config.appName} className="h-9 w-auto" />
          </Link>
          <Link href="/" className="text-sm text-base-content/50 hover:text-base-content">
            ← Back
          </Link>
        </header>

        <div className="flex flex-1 flex-col justify-center py-12">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-12">
            {/* Login */}
            <div className="mx-auto w-full max-w-md lg:mx-0">
              <div className="rounded-2xl border border-base-300 bg-base-100 p-7 shadow-lg sm:p-8">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Welcome to {config.appName}
                </h1>
                <p className="mt-2 text-sm text-base-content/60">
                  Sign in with Google to open your booking page, calendar, and
                  session packages.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    signIn("google", { callbackUrl: config.auth.callbackUrl })
                  }
                  className="btn btn-primary btn-block mt-7 h-12 gap-2 text-base normal-case"
                >
                  Continue with Google
                </button>
                <p className="mt-4 text-center text-xs text-base-content/40">
                  By continuing you agree to our{" "}
                  <Link href="/tos" className="underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy-policy" className="underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/* 3 feature cards — inline gradient so it always shows */}
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-base-content/45 px-1">
                Why {config.appName}
              </p>
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl p-4 sm:p-5 shadow-sm"
                  style={{
                    background: f.bg,
                    border: `1px solid ${f.border}`,
                  }}
                >
                  <div className="flex gap-3 items-start">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: f.iconBg }}
                    >
                      <span className="text-lg font-bold leading-none">
                        {f.title.charAt(0)}
                      </span>
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">
                        {f.title}
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-gray-600">
                        {f.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
