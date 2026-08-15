"use client";

import { useEffect, useState } from "react";

export default function FeedbackDashboard() {
  const [feedback, setFeedback] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setFeedback(data.feedback || []);
      setUsage(data.usage || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id, status) {
    const res = await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) load();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-20 rounded-2xl bg-base-200 animate-pulse" />
        <div className="h-40 rounded-2xl bg-base-200 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="text-2xl font-extrabold">Platform feedback</h1>
        <p className="text-sm text-error">{error}</p>
        <p className="text-xs text-base-content/55 leading-relaxed">
          This page is only for the product owner. In Vercel, set{" "}
          <code className="bg-base-300 px-1 rounded">ADMIN_EMAILS</code> to the
          Google email you use to sign in (comma-separated if multiple).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold">Platform feedback & usage</h1>
        <p className="text-sm text-base-content/60 mt-1">
          Site-wide numbers for <strong>your product</strong> (all coaches), and
          feedback sent to you as the builder—not coach-to-client messages.
        </p>
      </div>

      {usage && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Registered coaches", value: usage.registeredCoaches },
            {
              label: "Coaches with booking page",
              value: usage.coachesWithBookingPage,
            },
            { label: "Total bookings", value: usage.totalBookings },
            { label: "Confirmed bookings", value: usage.confirmedBookings },
            { label: "Unique clients (emails)", value: usage.uniqueClients },
            { label: "Session packages", value: usage.sessionPackages },
            { label: "Active event types", value: usage.activeEventTypes },
            {
              label: "Feedback",
              value: `${usage.feedbackNew} new / ${usage.feedbackTotal}`,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-base-300 bg-base-200 px-4 py-3"
            >
              <p className="text-[11px] uppercase tracking-wide text-base-content/45">
                {s.label}
              </p>
              <p className="text-xl font-bold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-bold">Product feedback inbox</h2>
        <p className="text-xs text-base-content/50">
          From the public booking page or landing page “Send feedback”.
        </p>
        {feedback.length === 0 ? (
          <p className="text-sm text-base-content/50">No feedback yet.</p>
        ) : (
          <ul className="space-y-3">
            {feedback.map((f) => (
              <li
                key={f.id}
                className={`rounded-xl border px-4 py-3 space-y-2 ${
                  f.status === "new"
                    ? "border-primary/40 bg-primary/5"
                    : "border-base-300 bg-base-100"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="badge badge-sm badge-ghost capitalize">
                    {f.category}
                  </span>
                  <span className="badge badge-sm capitalize">{f.status}</span>
                  {f.organizerUsername && (
                    <span className="text-base-content/45">
                      via /{f.organizerUsername}
                    </span>
                  )}
                  <span className="text-base-content/40">
                    {f.createdAt
                      ? new Date(f.createdAt).toLocaleString()
                      : ""}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{f.message}</p>
                {(f.email || f.name) && (
                  <p className="text-xs text-base-content/50">
                    Contact: {f.name || "—"} {f.email ? `<${f.email}>` : ""}
                  </p>
                )}
                <div className="flex gap-2">
                  {f.status === "new" && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setStatus(f.id, "read")}
                    >
                      Mark read
                    </button>
                  )}
                  {f.status !== "archived" && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setStatus(f.id, "archived")}
                    >
                      Archive
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
