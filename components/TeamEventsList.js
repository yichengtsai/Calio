"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog";

export default function TeamEventsList() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  async function load() {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      setEvents(data.events || []);
    } catch (e) {
      setError("Failed to load events");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleCancel(event) {
    setConfirmState({
      title: `Cancel "${event.title}"?`,
      description: "All participants will be notified by email.",
      confirmLabel: "Cancel event",
      danger: true,
      onConfirm: () => doCancel(event),
    });
  }

  async function doCancel(event) {
    setBusyId(event.id);
    try {
      await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      toast.success("Cancelled — participants have been notified");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <p className="text-sm text-error">{error}</p>;

  if (events === null) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-base-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-base-300 p-10 text-center">
        <p className="text-base-content/60 mb-4">You haven&apos;t created any events yet.</p>
        <Link href="/dashboard/events/new" className="btn btn-primary btn-sm">
          Create an event
        </Link>
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return (
    <div className="space-y-3">
      {sorted.map((e) => (
        <div
          key={e.id}
          className={`flex items-center gap-4 rounded-xl border border-base-300 bg-base-200 px-5 py-4 ${
            e.status === "cancelled" ? "opacity-50" : ""
          }`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: e.color || "#0ea5e9" }}
          />

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {e.title}
              {e.status === "cancelled" && (
                <span className="badge badge-ghost badge-sm ml-2">Cancelled</span>
              )}
            </p>
            <p className="text-xs text-base-content/50">
              {new Date(e.startTime).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <p className="text-xs text-base-content/50 mt-0.5">
              {e.participants?.length || 0} participant
              {e.participants?.length === 1 ? "" : "s"}
            </p>
          </div>

          {e.status !== "cancelled" && (
            <div className="flex items-center gap-1 shrink-0">
              <Link
                href={`/dashboard/events/${e.id}/edit`}
                className="btn btn-ghost btn-xs text-base-content/60"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => handleCancel(e)}
                disabled={busyId === e.id}
                className="btn btn-ghost btn-xs text-base-content/40 hover:text-error"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
