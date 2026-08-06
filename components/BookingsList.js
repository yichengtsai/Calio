"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog";

function toLocalDateInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookingsList() {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [tab, setTab] = useState("pending"); // pending | upcoming | past
  const [confirmState, setConfirmState] = useState(null);
  const [rescheduling, setRescheduling] = useState(null); // booking being rescheduled
  const [rescheduleForm, setRescheduleForm] = useState({ date: "", startTime: "", endTime: "" });
  const [isSavingReschedule, setIsSavingReschedule] = useState(false);
  const [rescheduleError, setRescheduleError] = useState(null);

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
        toast.error(data.error || "Something went wrong");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(booking) {
    await updateStatus(booking, "confirmed");
    toast.success("Approved");
  }

  function handleDecline(booking) {
    setConfirmState({
      title: `Decline the request from ${booking.inviteeName}?`,
      confirmLabel: "Decline",
      danger: true,
      onConfirm: async () => {
        await updateStatus(booking, "declined");
        toast.success("Declined");
      },
    });
  }

  function handleCancel(booking) {
    setConfirmState({
      title: `Cancel the booking with ${booking.inviteeName}?`,
      description: "They'll be notified by email.",
      confirmLabel: "Cancel booking",
      danger: true,
      onConfirm: async () => {
        await updateStatus(booking, "cancelled");
        toast.success("Cancelled — they've been notified");
      },
    });
  }

  function openReschedule(booking) {
    setRescheduleError(null);
    setRescheduleForm({
      date: toLocalDateInput(booking.startTime),
      startTime: toLocalTimeInput(booking.startTime),
      endTime: toLocalTimeInput(booking.endTime),
    });
    setRescheduling(booking);
  }

  async function handleSaveReschedule(e) {
    e.preventDefault();
    if (!rescheduling) return;
    setRescheduleError(null);

    const startTime = new Date(
      `${rescheduleForm.date}T${rescheduleForm.startTime}:00`
    ).toISOString();
    const endTime = new Date(`${rescheduleForm.date}T${rescheduleForm.endTime}:00`).toISOString();

    setIsSavingReschedule(true);
    try {
      const res = await fetch(`/api/bookings/${rescheduling.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime, endTime }),
      });
      const data = await res.json();

      if (!res.ok) {
        setRescheduleError(data.error || "Failed to reschedule");
        return;
      }

      setRescheduling(null);
      toast.success(
        data.rescheduled
          ? "Rescheduled — the guest has been notified by email"
          : "No change — the time was already set to that"
      );
      await load();
    } catch (err) {
      setRescheduleError("Something went wrong. Please try again.");
    } finally {
      setIsSavingReschedule(false);
    }
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
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openReschedule(b)}
                      disabled={busyId === b.id}
                      className="btn btn-ghost btn-xs text-base-content/50 hover:text-primary"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(b)}
                      disabled={busyId === b.id}
                      className="btn btn-ghost btn-xs text-base-content/40 hover:text-error"
                    >
                      Cancel
                    </button>
                  </div>
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

      {rescheduling && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-opacity"
          onClick={() => setRescheduling(null)}
        >
          <form
            onSubmit={handleSaveReschedule}
            className="bg-base-100 border border-base-300 rounded-2xl max-w-sm w-full p-6 space-y-4 animate-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg">Reschedule</h2>
                <p className="text-xs text-base-content/50">{rescheduling.inviteeName}</p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduling(null)}
                className="text-base-content/40 hover:text-base-content"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-base-content/50 -mt-2">
              They&apos;ll get an email with the new time — this booking stays confirmed.
            </p>

            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-1">Date</label>
              <input
                type="date"
                required
                value={rescheduleForm.date}
                onChange={(e) =>
                  setRescheduleForm((f) => ({ ...f, date: e.target.value }))
                }
                className="input input-bordered input-sm w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-base-content/80 mb-1">
                  Start
                </label>
                <input
                  type="time"
                  required
                  value={rescheduleForm.startTime}
                  onChange={(e) =>
                    setRescheduleForm((f) => ({ ...f, startTime: e.target.value }))
                  }
                  className="input input-bordered input-sm w-full"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-base-content/80 mb-1">
                  End
                </label>
                <input
                  type="time"
                  required
                  value={rescheduleForm.endTime}
                  onChange={(e) =>
                    setRescheduleForm((f) => ({ ...f, endTime: e.target.value }))
                  }
                  className="input input-bordered input-sm w-full"
                />
              </div>
            </div>

            {rescheduleError && <p className="text-sm text-error">{rescheduleError}</p>}

            <button
              type="submit"
              disabled={isSavingReschedule}
              className="btn btn-primary btn-sm w-full"
            >
              {isSavingReschedule ? "Saving…" : "Save new time"}
            </button>
          </form>
        </div>
      )}

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
