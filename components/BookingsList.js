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

    // 樂觀更新：先改本地狀態讓 pending 立刻消失，再打 API；失敗才還原
  async function updateStatus(booking, status, extra = {}) {
    const previous = bookings;
    setBusyId(booking.id);
    setBookings((list) =>
      (list || []).map((b) =>
        b.id === booking.id
          ? {
              ...b,
              status,
              respondedAt: new Date().toISOString(),
              ...(status === "cancelled" || status === "declined"
                ? { cancelReason: extra.cancelReason || undefined }
                : {}),
            }
          : b
      )
    );

    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBookings(previous);
        toast.error(data.error || "Something went wrong");
        return false;
      }
      // 用伺服器回傳對齊（含 meetingUrl 等），不整表重抓，避免閃爍
      if (data.booking) {
        setBookings((list) =>
          (list || []).map((b) => (b.id === booking.id ? { ...b, ...data.booking } : b))
        );
      }
      return true;
    } catch (e) {
      setBookings(previous);
      toast.error("Something went wrong");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(booking) {
    const ok = await updateStatus(booking, "confirmed");
    if (ok) toast.success("Approved — confirmation email sent");
  }

  function handleDecline(booking) {
    setConfirmState({
      title: `Decline the request from ${booking.inviteeName}?`,
      description: "They'll get an email. You can optionally tell them why.",
      confirmLabel: "Decline",
      danger: true,
      reasonField: {
        label: "Reason",
        placeholder: "e.g. That time no longer works for me — sorry!",
        optional: true,
      },
      onConfirm: async (reason) => {
        const ok = await updateStatus(
          booking,
          "declined",
          reason ? { cancelReason: reason } : {}
        );
        if (ok) toast.success("Declined — email sent to guest");
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

  const tabMeta = {
    pending: {
      label: "Pending",
      count: pending.length,
      bg: "linear-gradient(145deg, color-mix(in oklab, #f59e0b 22%, var(--color-base-100)), var(--color-base-100))",
      border: "color-mix(in oklab, #f59e0b 55%, var(--color-base-300))",
      activeRing: "#f59e0b",
    },
    upcoming: {
      label: "Upcoming",
      count: upcoming.length,
      bg: "linear-gradient(145deg, color-mix(in oklab, #0ea5e9 22%, var(--color-base-100)), var(--color-base-100))",
      border: "color-mix(in oklab, #0ea5e9 55%, var(--color-base-300))",
      activeRing: "#0ea5e9",
    },
    past: {
      label: "Past",
      count: past.length,
      bg: "linear-gradient(145deg, color-mix(in oklab, #8b5cf6 22%, var(--color-base-100)), var(--color-base-100))",
      border: "color-mix(in oklab, #8b5cf6 55%, var(--color-base-300))",
      activeRing: "#8b5cf6",
    },
  };

  const rowStyle = {
    pending: {
      background:
        "linear-gradient(145deg, color-mix(in oklab, #f59e0b 18%, var(--color-base-100)), var(--color-base-100))",
      border: "2px solid color-mix(in oklab, #f59e0b 50%, var(--color-base-300))",
    },
    upcoming: {
      background:
        "linear-gradient(145deg, color-mix(in oklab, #0ea5e9 18%, var(--color-base-100)), var(--color-base-100))",
      border: "2px solid color-mix(in oklab, #0ea5e9 50%, var(--color-base-300))",
    },
    past: {
      background:
        "linear-gradient(145deg, color-mix(in oklab, #8b5cf6 18%, var(--color-base-100)), var(--color-base-100))",
      border: "2px solid color-mix(in oklab, #8b5cf6 50%, var(--color-base-300))",
    },
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2.5">
        {(["pending", "upcoming", "past"]).map((id) => {
          const m = tabMeta[id];
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="text-left rounded-xl px-3 py-3 transition-all active:scale-[0.98]"
              style={{
                background: m.bg,
                border: active ? `3px solid ${m.activeRing}` : `2px solid ${m.border}`,
                boxShadow: active
                  ? `0 0 0 3px ${m.activeRing}40, 0 4px 12px ${m.activeRing}30`
                  : "0 1px 3px rgba(0,0,0,0.06)",
                transform: active ? "translateY(-1px)" : undefined,
                opacity: active ? 1 : 0.85,
              }}
            >
              <p className="text-[11px] font-medium text-base-content/70">{m.label}</p>
              <p className="text-xl font-bold tabular-nums mt-0.5">{m.count}</p>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-300 p-10 text-center text-sm text-base-content/50 bg-base-100/80">
          {tab === "pending" && "No requests waiting on you."}
          {tab === "upcoming" && "No upcoming bookings."}
          {tab === "past" && "Nothing here yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <div
              key={b.id}
              className={`rounded-xl px-5 py-4 shadow-sm ${
                b.status === "cancelled" || b.status === "declined" ? "opacity-50" : ""
              }`}
              style={rowStyle[tab] || rowStyle.upcoming}
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
