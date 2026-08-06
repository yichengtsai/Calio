"use client";

import { useEffect, useState } from "react";

export default function BookingsList() {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [tab, setTab] = useState("pending"); // pending | upcoming | past

  async function load() {
    try {
      const res = await fetch("/api/bookings");
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (e) {
      setError("Failed to load bookings");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(booking, status) {
    setBusyId(booking.id);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Something went wrong");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(booking) {
    await updateStatus(booking, "confirmed");
  }

  async function handleDecline(booking) {
    if (!confirm(`Decline the request from ${booking.inviteeName}?`)) return;
    await updateStatus(booking, "declined");
  }

  async function handleCancel(booking) {
    if (!confirm(`Cancel the booking with ${booking.inviteeName}? They'll be notified by email.`))
      return;
    await updateStatus(booking, "cancelled");
  }

  if (error) return <p className="text-sm text-error">{error}</p>;

  if (bookings === null) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-base-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const now = new Date();
  const pending = bookings
    .filter((b) => b.status === "pending")
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const upcoming = bookings
    .filter((b) => b.status === "confirmed" && new Date(b.startTime) >= now)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const past = bookings
    .filter(
      (b) =>
        b.status === "cancelled" ||
        b.status === "declined" ||
        (b.status === "confirmed" && new Date(b.startTime) < now)
    )
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  const list = tab === "pending" ? pending : tab === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-5">
      <div role="tablist" className="tabs tabs-boxed w-fit">
        <button
          role="tab"
          onClick={() => setTab("pending")}
          className={`tab ${tab === "pending" ? "tab-active" : ""}`}
        >
          Pending ({pending.length})
        </button>
        <button
          role="tab"
          onClick={() => setTab("upcoming")}
          className={`tab ${tab === "upcoming" ? "tab-active" : ""}`}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          role="tab"
          onClick={() => setTab("past")}
          className={`tab ${tab === "past" ? "tab-active" : ""}`}
        >
          Past ({past.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-300 p-10 text-center text-sm text-base-content/50">
          {tab === "pending" && "No requests waiting on you."}
          {tab === "upcoming" && "No upcoming bookings."}
          {tab === "past" && "Nothing here yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <div
              key={b.id}
              className={`rounded-xl border px-5 py-4 ${
                b.status === "pending"
                  ? "border-warning/40 bg-warning/5"
                  : "border-base-300 bg-base-200"
              } ${b.status === "cancelled" || b.status === "declined" ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-4">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: b.eventType?.color || "#6366f1" }}
                />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {b.eventType?.title || "Event"}
                    {b.status === "cancelled" && (
                      <span className="badge badge-ghost badge-sm ml-2">Cancelled</span>
                    )}
                    {b.status === "declined" && (
                      <span className="badge badge-ghost badge-sm ml-2">Declined</span>
                    )}
                  </p>
                  <p className="text-xs text-base-content/50">
                    {new Date(b.startTime).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-base-content/50 mt-0.5">
                    {b.inviteeName} · {b.inviteeEmail}
                  </p>
                  {b.inviteeNotes && (
                    <p className="text-xs text-base-content/40 mt-1 italic truncate">
                      &ldquo;{b.inviteeNotes}&rdquo;
                    </p>
                  )}
                </div>

                {tab === "upcoming" && (
                  <button
                    type="button"
                    onClick={() => handleCancel(b)}
                    disabled={busyId === b.id}
                    className="btn btn-ghost btn-xs text-base-content/40 hover:text-error shrink-0"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {tab === "pending" && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-base-300/60">
                  <button
                    type="button"
                    onClick={() => handleApprove(b)}
                    disabled={busyId === b.id}
                    className="btn btn-success btn-sm flex-1"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(b)}
                    disabled={busyId === b.id}
                    className="btn btn-ghost btn-sm flex-1"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
