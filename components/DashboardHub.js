"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CalendarView from "@/components/CalendarView";
import BookingsList from "@/components/BookingsList";
import EventTypeList from "@/components/EventTypeList";
import AvailabilityForm from "@/components/AvailabilityForm";

const TABS = [
  { id: "calendar", label: "Calendar" },
  { id: "bookings", label: "Bookings", tourId: "bookings" },
  { id: "event-types", label: "Event types", tourId: "event-types" },
];

export default function DashboardHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState(
    TABS.some((t) => t.id === initialTab) ? initialTab : "calendar"
  );
  const [showAvailability, setShowAvailability] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [mountedTabs, setMountedTabs] = useState(() => new Set(["calendar", "bookings", "event-types"]));

  useEffect(() => {
    const t = searchParams.get("tab");
    if (TABS.some((x) => x.id === t) && t !== tab) {
      setTab(t);
      setMountedTabs((prev) => new Set(prev).add(t));
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bookings/pending-count")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setPendingCount(data.count || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const selectTab = useCallback(
    (id) => {
      if (id === tab) return;
      // UI first (instant), URL second — avoid startTransition lag on tab content
      setTab(id);
      setMountedTabs((prev) => new Set(prev).add(id));
      const url = id === "calendar" ? "/dashboard" : `/dashboard?tab=${id}`;
      router.replace(url, { scroll: false });
    },
    [tab, router]
  );

  return (
    <section
      className="space-y-5 max-w-[1400px] -mx-2 px-2 sm:-mx-0 sm:px-0 rounded-2xl"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 520px 260px at 0% 0%, color-mix(in oklab, var(--color-primary) 14%, transparent), transparent 70%), radial-gradient(ellipse 420px 220px at 100% 0%, color-mix(in oklab, var(--color-secondary) 12%, transparent), transparent 70%)",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "top left, top right",
      }}
    >
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 calio-enter rounded-2xl border border-base-300/70 bg-base-100/80 backdrop-blur-sm px-4 py-3.5 shadow-sm"
      >
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Workspace</h1>
          <p className="text-base-content/50 mt-0.5 text-sm">
            Calendar, bookings, and what clients can book.
          </p>
        </div>
        <button
          type="button"
          data-tour="availability"
          onClick={() => setShowAvailability(true)}
          className="btn btn-outline btn-sm self-start sm:self-auto"
        >
          Weekly hours
        </button>
      </div>

      <div className="inline-flex p-1 rounded-xl bg-base-100/90 border border-base-300/80 gap-0.5 shadow-sm calio-enter calio-enter-delay-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-tour={t.tourId || undefined}
              onClick={() => selectTab(t.id)}
              className={`calio-seg-btn px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors duration-100 ${
                active
                  ? "calio-seg-btn-active bg-base-100 text-base-content"
                  : "text-base-content/55 hover:text-base-content"
              }`}
            >
              {t.label}
              {t.id === "bookings" && pendingCount > 0 && (
                <span className="ml-1.5 badge badge-warning badge-sm text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        className={tab === "calendar" ? "block" : "hidden"}
        data-tour="calendar"
      >
        <div
          className="rounded-2xl border border-base-300/60 shadow-sm p-3 sm:p-4"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 520px 260px at 0% 0%, color-mix(in oklab, var(--color-primary) 14%, transparent), transparent 70%), radial-gradient(ellipse 420px 220px at 100% 0%, color-mix(in oklab, var(--color-secondary) 12%, transparent), transparent 70%)",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "top left, top right",
          }}
        >
          {mountedTabs.has("calendar") && <CalendarView />}
        </div>
      </div>
      <div className={tab === "bookings" ? "block" : "hidden"}>
        {mountedTabs.has("bookings") && (
          <div
            className="rounded-2xl border border-base-300/60 shadow-sm p-4 sm:p-5 space-y-3"
            style={{
            backgroundImage:
              "radial-gradient(ellipse 520px 260px at 0% 0%, color-mix(in oklab, var(--color-primary) 14%, transparent), transparent 70%), radial-gradient(ellipse 420px 220px at 100% 0%, color-mix(in oklab, var(--color-secondary) 12%, transparent), transparent 70%)",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "top left, top right",
          }}
          >
            <p className="text-sm text-base-content/50">
              Pending, upcoming, and past bookings from your public page.
            </p>
            <BookingsList />
          </div>
        )}
      </div>
      <div className={tab === "event-types" ? "block" : "hidden"}>
        {mountedTabs.has("event-types") && (
          <div
            className="rounded-2xl border border-base-300/60 shadow-sm p-4 sm:p-5 space-y-3"
            style={{
            backgroundImage:
              "radial-gradient(ellipse 520px 260px at 0% 0%, color-mix(in oklab, var(--color-primary) 14%, transparent), transparent 70%), radial-gradient(ellipse 420px 220px at 100% 0%, color-mix(in oklab, var(--color-secondary) 12%, transparent), transparent 70%)",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "top left, top right",
          }}
          >
            <p className="text-sm text-base-content/50">
              Meeting types on your booking page (duration, buffer, location).
            </p>
            <EventTypeList />
          </div>
        )}
      </div>

      {showAvailability && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-opacity"
          onClick={() => setShowAvailability(false)}
        >
          <div
            className="bg-base-100 border border-base-300 rounded-2xl max-w-lg w-full p-6 space-y-4 animate-popup max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg">Weekly availability</h2>
                <p className="text-xs text-base-content/50 mt-0.5">
                  Hours you&apos;re open for public bookings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAvailability(false)}
                className="btn btn-ghost btn-sm btn-circle"
              >
                ✕
              </button>
            </div>
            <AvailabilityForm />
          </div>
        </div>
      )}
    </section>
  );
}
