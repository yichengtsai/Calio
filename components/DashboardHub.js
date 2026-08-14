"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CalendarView from "@/components/CalendarView";
import BookingsList from "@/components/BookingsList";
import EventTypeList from "@/components/EventTypeList";
import AvailabilityForm from "@/components/AvailabilityForm";

const TABS = [
  { id: "calendar", label: "Calendar" },
  { id: "bookings", label: "Bookings" },
  { id: "event-types", label: "Event types" },
];

export default function DashboardHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState(
    TABS.some((t) => t.id === initialTab) ? initialTab : "calendar"
  );
  const [showAvailability, setShowAvailability] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  // 各 tab 掛載後保留，避免每次切換都重抓資料造成卡頓
  const [mountedTabs, setMountedTabs] = useState(() => new Set([tab]));

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
      setTab(id);
      setMountedTabs((prev) => new Set(prev).add(id));
      const url = id === "calendar" ? "/dashboard" : `/dashboard?tab=${id}`;
      startTransition(() => {
        router.replace(url, { scroll: false });
      });
    },
    [tab, router]
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold">Calendar</h1>
          <p className="text-base-content/60 mt-1 text-sm">
            Schedule, bookings, and what people can book — in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAvailability(true)}
            className="btn btn-outline btn-sm"
          >
            Availability
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-base-300 pb-0">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-base-content/55 hover:text-base-content"
              } ${isPending ? "opacity-80" : ""}`}
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

      {/* 保持掛載，只切 display，減少重載造成的卡頓 */}
      <div className={tab === "calendar" ? "block" : "hidden"}>
        {mountedTabs.has("calendar") && <CalendarView />}
      </div>
      <div className={tab === "bookings" ? "block" : "hidden"}>
        {mountedTabs.has("bookings") && (
          <div className="space-y-2">
            <p className="text-sm text-base-content/55">
              Pending, upcoming, and past bookings from your public page.
            </p>
            <BookingsList />
          </div>
        )}
      </div>
      <div className={tab === "event-types" ? "block" : "hidden"}>
        {mountedTabs.has("event-types") && (
          <div className="space-y-2">
            <p className="text-sm text-base-content/55">
              Services people can book on your page (duration, buffer, location, etc.).
            </p>
            <EventTypeList />
          </div>
        )}
      </div>

      {showAvailability && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-opacity"
          onClick={() => setShowAvailability(false)}
        >
          <div
            className="bg-base-100 border border-base-300 rounded-2xl max-w-lg w-full p-6 space-y-4 animate-popup max-h-[90vh] overflow-y-auto"
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
                className="text-base-content/40 hover:text-base-content shrink-0"
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
