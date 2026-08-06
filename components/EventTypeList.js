"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function EventTypeList() {
  const [eventTypes, setEventTypes] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      const res = await fetch("/api/event-types");
      const data = await res.json();
      setEventTypes(data.eventTypes || []);
    } catch (e) {
      setError("Failed to load event types");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(eventType) {
    setBusyId(eventType.id);
    try {
      await fetch(`/api/event-types/${eventType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !eventType.isActive }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(eventType) {
    if (!confirm(`Delete "${eventType.title}"? This can't be undone.`)) return;
    setBusyId(eventType.id);
    try {
      await fetch(`/api/event-types/${eventType.id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <p className="text-sm text-error">{error}</p>;
  }

  if (eventTypes === null) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-base-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (eventTypes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-base-300 p-10 text-center">
        <p className="text-base-content/60 mb-4">You haven&apos;t created any event types yet.</p>
        <Link href="/dashboard/event-types/new" className="btn btn-primary btn-sm">
          Create your first event type
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {eventTypes.map((et) => (
        <div
          key={et.id}
          className={`flex items-center gap-4 rounded-xl border border-base-300 bg-base-200 px-5 py-4 transition-opacity ${
            et.isActive ? "" : "opacity-50"
          }`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: et.color }}
          />

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{et.title}</p>
            <p className="text-xs text-base-content/50">
              {et.duration} min{et.location ? ` · ${et.location}` : ""} ·{" "}
              {et.requiresApproval ? "Needs approval" : "Auto-confirm"}
            </p>
          </div>

          <input
            type="checkbox"
            checked={et.isActive}
            onChange={() => toggleActive(et)}
            disabled={busyId === et.id}
            className="toggle toggle-sm toggle-primary"
          />

          <button
            type="button"
            onClick={() => handleDelete(et)}
            disabled={busyId === et.id}
            className="btn btn-ghost btn-xs text-base-content/40 hover:text-error"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
