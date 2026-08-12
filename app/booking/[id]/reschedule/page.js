"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function formatWhen(iso, timezone) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || undefined,
    });
  } catch {
    return String(iso);
  }
}

function toDateInputValue(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function RescheduleInner({ id }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [newStart, setNewStart] = useState(null);

  const [dateStr, setDateStr] = useState(toDateInputValue());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const timezone = useMemo(() => {
    return (
      meta?.booking?.inviteeTimezone ||
      meta?.organizer?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  }, [meta]);

  useEffect(() => {
    if (!token) {
      setError("This link is missing information and can't be used.");
      return;
    }

    fetch(`/api/public/bookings/${id}/reschedule?token=${encodeURIComponent(token)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || "This booking couldn't be found.");
          return;
        }
        if (data.booking?.status === "cancelled" || data.booking?.status === "declined") {
          setError("This booking can no longer be rescheduled.");
          return;
        }
        setMeta(data);
      })
      .catch(() => setError("Something went wrong. Please try again later."));
  }, [id, token]);

  useEffect(() => {
    if (!meta?.organizer?.username || !meta?.eventType?.slug || !dateStr) return;

    const controller = new AbortController();
    setLoadingSlots(true);
    setSelectedSlot(null);
    setSlots([]);

    fetch(
      `/api/public/availability?username=${encodeURIComponent(
        meta.organizer.username
      )}&slug=${encodeURIComponent(meta.eventType.slug)}&date=${encodeURIComponent(dateStr)}`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : { slots: [] }))
      .then((data) => {
        const list = (data.slots || data.availableSlots || [])
          .map((s) => (typeof s === "string" ? s : s.start || s.startTime))
          .filter(Boolean);
        setSlots(list);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));

    return () => controller.abort();
  }, [meta, dateStr]);

  async function handleSubmit() {
    if (!selectedSlot || !token) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/bookings/${id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, startTime: selectedSlot }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reschedule");
        return;
      }
      setNewStart(data.booking?.startTime || selectedSlot);
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again later.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main
      className="min-h-screen py-16 px-6 flex items-center justify-center"
      data-theme="deepwork"
    >
      <div className="max-w-md w-full rounded-2xl border border-base-300 bg-base-200 p-6 space-y-4">
        {error ? (
          <p className="text-sm text-error text-center">{error}</p>
        ) : done ? (
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto">
              ✓
            </div>
            <p className="font-bold">Rescheduled</p>
            <p className="text-sm text-base-content/60">
              Your new time is{" "}
              <span className="font-medium text-base-content">
                {formatWhen(newStart, timezone)}
              </span>
              . A confirmation email is on the way.
            </p>
            {meta?.cancelUrl && (
              <a href={meta.cancelUrl} className="text-xs text-base-content/50 underline">
                Need to cancel instead?
              </a>
            )}
          </div>
        ) : !meta ? (
          <p className="text-sm text-base-content/50 text-center">Loading…</p>
        ) : (
          <>
            <div>
              <p className="text-xs text-base-content/50">Reschedule with</p>
              <h1 className="font-bold text-lg">{meta.organizer?.name}</h1>
              <p className="text-sm text-base-content/70 mt-1">{meta.booking.title}</p>
              <p className="text-xs text-base-content/50 mt-2">
                Current: {formatWhen(meta.booking.startTime, timezone)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Pick a new date</label>
              <input
                type="date"
                value={dateStr}
                min={toDateInputValue()}
                onChange={(e) => setDateStr(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Available times</p>
              {loadingSlots ? (
                <p className="text-xs text-base-content/50">Loading slots…</p>
              ) : slots.length === 0 ? (
                <p className="text-xs text-base-content/50">
                  No open times on this day. Try another date.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {slots.map((slot) => {
                    const label = new Date(slot).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: timezone,
                    });
                    const active = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`btn btn-sm ${active ? "btn-primary" : "btn-outline"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!selectedSlot || isSaving}
              onClick={handleSubmit}
              className="btn btn-primary w-full"
            >
              {isSaving ? "Saving…" : "Confirm new time"}
            </button>

            {meta.cancelUrl && (
              <a
                href={meta.cancelUrl}
                className="block text-center text-xs text-base-content/45 hover:underline"
              >
                Cancel this booking instead
              </a>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function RescheduleBookingPage({ params }) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-base-content/50">Loading…</p>
        </main>
      }
    >
      <RescheduleInner id={id} />
    </Suspense>
  );
}
