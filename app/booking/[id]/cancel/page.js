"use client";

import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function CancelInner({ id }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [canCancel, setCanCancel] = useState(true);
  const [blockedReason, setBlockedReason] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("This link is missing information and can't be used.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    setLoading(true);
    fetch(`/api/public/bookings/${id}/cancel?token=${encodeURIComponent(token)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || "This booking couldn't be found.");
          return;
        }
        setBooking(data.booking);
        if (data.canCancel === false) {
          setCanCancel(false);
          setBlockedReason(data.cancelBlockedReason || "This booking can no longer be cancelled.");
        }
      })
      .catch((e) => {
        if (e.name === "AbortError") {
          setError(
            "This is taking too long (database may be waking up). Please refresh the page."
          );
        } else {
          setError("Something went wrong. Please try again later.");
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [id, token]);

  async function handleCancel() {
    if (!canCancel) return;
    setIsCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/bookings/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel this booking.");
        return;
      }
      setDone(true);
    } catch (e) {
      setError("Something went wrong. Please try again later.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main
      className="min-h-screen py-16 px-6 flex items-center justify-center bg-base-100"
    >
      <div className="max-w-sm w-full rounded-2xl border border-base-300 bg-base-200 p-6 space-y-4">
        {error ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-error">{error}</p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : done ? (
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto">
              ✓
            </div>
            <p className="font-bold">Booking cancelled</p>
            <p className="text-sm text-base-content/60">
              This time has been freed up. You&apos;re welcome to book another time if you&apos;d
              like.
            </p>
          </div>
        ) : loading || !booking ? (
          <div className="text-center space-y-2">
            <span className="loading loading-spinner loading-md" />
            <p className="text-sm text-base-content/50">Loading your booking…</p>
            <p className="text-xs text-base-content/40">
              First load can take a few seconds if the database is waking up.
            </p>
          </div>
        ) : booking.status === "cancelled" ? (
          <p className="text-sm text-base-content/60 text-center">
            This booking has already been cancelled.
          </p>
        ) : (
          <>
            <div className="text-center space-y-1">
              <p className="font-bold text-lg">{booking.title}</p>
              <p className="text-sm text-base-content/60">
                {new Date(booking.startTime).toLocaleString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
              {booking.location && (
                <p className="text-xs text-base-content/40">{booking.location}</p>
              )}
            </div>
            <p className="text-sm text-center text-base-content/70">
              Cancel this booking, {booking.inviteeName}?
            </p>
            {!canCancel && blockedReason && (
              <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error mb-3">
                {blockedReason}
              </div>
            )}
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling || !canCancel}
              className="btn btn-error btn-sm w-full"
            >
              {isCancelling ? "Cancelling…" : "Yes, cancel this booking"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function CancelBookingPage({ params }) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-base-100" >
          <p className="text-sm text-base-content/50">Loading…</p>
        </main>
      }
    >
      <CancelInner id={id} />
    </Suspense>
  );
}
