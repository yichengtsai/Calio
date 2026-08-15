"use client";

import { useState } from "react";

/**
 * Product feedback for the Calio builders (not coach-specific inbox).
 * username is optional context only (which page they were on).
 */
export default function FeedbackForm({ username = "", compact = false }) {
  const [open, setOpen] = useState(!compact);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("idea");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/public/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          email: email || undefined,
          category,
          username: username || undefined,
          sourcePath:
            typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send");
        return;
      }
      setDone(true);
      setMessage("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (!open && compact) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-base-content/45 hover:text-base-content underline underline-offset-2"
        >
          Feedback for Calio
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/10 px-5 py-4 text-center space-y-1">
        <p className="text-sm font-semibold text-success">Thanks for the feedback!</p>
        <p className="text-xs text-base-content/55">
          The Calio team reads every message.
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-xs mt-2"
          onClick={() => {
            setDone(false);
            if (compact) setOpen(false);
          }}
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-base-300 bg-base-200/80 p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Feedback for Calio</h3>
          <p className="text-xs text-base-content/50 mt-0.5">
            Tell the product team what to improve—not a message to the coach.
          </p>
        </div>
        {compact && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "idea", label: "Idea" },
            { id: "bug", label: "Bug" },
            { id: "other", label: "Other" },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`btn btn-xs ${
                category === c.id ? "btn-primary" : "btn-ghost border border-base-300"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <textarea
          required
          rows={3}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="textarea textarea-bordered w-full text-sm"
          placeholder="What should we improve or add?"
        />

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input input-bordered input-sm w-full"
          placeholder="Your email (optional)"
        />

        {error && <p className="text-xs text-error">{error}</p>}

        <button
          type="submit"
          disabled={sending}
          className="btn btn-primary btn-sm w-full"
        >
          {sending ? "Sending…" : "Send to Calio team"}
        </button>
      </form>
    </div>
  );
}
