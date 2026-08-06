"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function CancelBookingPage({ params }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("This link is missing information and can't be used.");
      return;
    }

    fetch(`/api/public/bookings/${id}/cancel?token=${encodeURIComponent(token)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || "This booking couldn't be found.");
          return;
        }
        setBooking(data.booking);
      })
      .catch(() => setError("Something went wrong. Please try again later."));
  }, [id, token]);

  async function handleCancel() {
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
    <main className="min-h-screen py-16 px-6 flex items-center justify-center" data-theme="deepwork">
      <div className="max-w-sm w-full rounded-2xl border border-base-300 bg-base-200 p-6 space-y-4">
        {error ? (
          <p className="text-sm text-error text-center">{error}</p>
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
        ) : booking ? (
          booking.status === "cancelled" ? (
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
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="btn btn-error btn-sm w-full"
              >
                {isCancelling ? "Cancelling…" : "Yes, cancel this booking"}
              </button>
            </>
          )
        ) : (
          <p className="text-sm text-base-content/50 text-center">Loading…</p>
        )}
      </div>
    </main>
  );
}
