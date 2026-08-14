"use client";

import { use, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TimezoneSelect from "@/components/TimezoneSelect";
import {
  addDaysToDateStr,
  dateStrInTimezone,
  formatTimezoneLabel,
} from "@/libs/timezone";

const MAX_ADVANCE_DAYS = 60;

function partsFromDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d, anchor: new Date(Date.UTC(y, m - 1, d)) };
}

function weekdayShort(dateStr) {
  return partsFromDateStr(dateStr).anchor.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function dayOfMonth(dateStr) {
  return partsFromDateStr(dateStr).d;
}

function monthYearLabel(dateStr) {
  return partsFromDateStr(dateStr).anchor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatSlotTime(iso, timeZone) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

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

function buildCalendarWeeks(year, month) {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function ChevronIcon({ direction = "left" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path
        fillRule="evenodd"
        d={
          direction === "left"
            ? "M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
            : "M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        }
        clipRule="evenodd"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function RescheduleInner({ id }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [newStart, setNewStart] = useState(null);

  const [timezone, setTimezone] = useState(null);
  const [monthCursor, setMonthCursor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [rawSlotsByDate, setRawSlotsByDate] = useState(new Map());
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const brandColor = "#6366f1";

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
        setTimezone(
          data.booking?.inviteeTimezone ||
            data.organizer?.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone
        );
      })
      .catch(() => setError("Something went wrong. Please try again later."));
  }, [id, token]);

  function handleTimezoneChange(tz) {
    setTimezone(tz);
    setSelectedDate(null);
    setSelectedSlot(null);
  }

  const todayStr = useMemo(
    () => (timezone ? dateStrInTimezone(new Date(), timezone) : null),
    [timezone]
  );
  const maxDateStr = useMemo(
    () => (todayStr ? addDaysToDateStr(todayStr, MAX_ADVANCE_DAYS) : null),
    [todayStr]
  );

  useEffect(() => {
    if (!todayStr || monthCursor) return;
    const { y, m } = partsFromDateStr(todayStr);
    setMonthCursor({ year: y, month: m - 1 });
  }, [todayStr, monthCursor]);

  const weeks = useMemo(
    () => (monthCursor ? buildCalendarWeeks(monthCursor.year, monthCursor.month) : []),
    [monthCursor]
  );
  const monthLabel = useMemo(
    () =>
      monthCursor
        ? new Date(Date.UTC(monthCursor.year, monthCursor.month, 1)).toLocaleDateString(
            "en-US",
            { month: "long", year: "numeric", timeZone: "UTC" }
          )
        : "",
    [monthCursor]
  );

  const canGoPrevMonth = useMemo(() => {
    if (!monthCursor || !todayStr) return false;
    const { y, m } = partsFromDateStr(todayStr);
    return monthCursor.year > y || (monthCursor.year === y && monthCursor.month > m - 1);
  }, [monthCursor, todayStr]);

  const canGoNextMonth = useMemo(() => {
    if (!monthCursor || !maxDateStr) return false;
    const { y, m } = partsFromDateStr(maxDateStr);
    return monthCursor.year < y || (monthCursor.year === y && monthCursor.month < m - 1);
  }, [monthCursor, maxDateStr]);

  const username = meta?.organizer?.username;
  const slug = meta?.eventType?.slug;

  useEffect(() => {
    if (!monthCursor || !username || !slug) return;
    const { year, month } = monthCursor;
    const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const firstOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`;

    const controller = new AbortController();
    setIsLoadingCalendar(true);

    fetch(
      `/api/public/availability/month?username=${encodeURIComponent(username)}&slug=${encodeURIComponent(
        slug
      )}&start=${firstOfMonth}&end=${lastOfMonth}`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : { slotsByDate: {} }))
      .then((data) => {
        setRawSlotsByDate((prev) => {
          const next = new Map(prev);
          Object.entries(data.slotsByDate || {}).forEach(([d, isoList]) =>
            next.set(d, isoList)
          );
          return next;
        });
      })
      .catch(() => {})
      .finally(() => setIsLoadingCalendar(false));

    return () => controller.abort();
  }, [monthCursor, username, slug]);

  const availabilityMap = useMemo(() => {
    const map = new Map();
    if (!timezone) return map;
    weeks.flat().forEach((day) => {
      if (!day) return;
      const candidateDates = [addDaysToDateStr(day, -1), day, addDaysToDateStr(day, 1)];
      if (!candidateDates.every((d) => rawSlotsByDate.has(d))) return;
      const merged = new Map();
      candidateDates.forEach((d) =>
        (rawSlotsByDate.get(d) || []).forEach((iso) => merged.set(iso, iso))
      );
      map.set(
        day,
        [...merged.values()].some(
          (iso) => dateStrInTimezone(new Date(iso), timezone) === day
        )
      );
    });
    return map;
  }, [weeks, rawSlotsByDate, timezone]);

  const selectedDateSlots = useMemo(() => {
    if (!selectedDate || !timezone) return null;
    const candidateDates = [
      addDaysToDateStr(selectedDate, -1),
      selectedDate,
      addDaysToDateStr(selectedDate, 1),
    ];
    if (!candidateDates.every((d) => rawSlotsByDate.has(d))) return null;
    const merged = new Map();
    candidateDates.forEach((d) =>
      (rawSlotsByDate.get(d) || []).forEach((iso) => merged.set(iso, iso))
    );
    return [...merged.values()]
      .filter((iso) => dateStrInTimezone(new Date(iso), timezone) === selectedDate)
      .sort((a, b) => new Date(a) - new Date(b));
  }, [selectedDate, rawSlotsByDate, timezone]);

  const slots = selectedDateSlots || [];
  const isLoadingSlots = !!selectedDate && selectedDateSlots === null;

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
    <main className="min-h-screen py-8 sm:py-12 px-4 sm:px-6 bg-base-100">
      <div className="max-w-2xl mx-auto">
        {error && !meta ? (
          <div className="rounded-2xl border border-base-300 bg-base-200 p-8 text-center">
            <p className="text-sm text-error">{error}</p>
          </div>
        ) : done ? (
          <div className="rounded-2xl border border-base-300 bg-base-200 overflow-hidden">
            <div className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto text-2xl">
                ✓
              </div>
              <h2 className="text-lg font-bold">Rescheduled</h2>
              <p className="text-sm text-base-content/60">
                Your new time is{" "}
                <span className="font-medium text-base-content">
                  {formatWhen(newStart, timezone)}
                </span>
                . A confirmation email is on the way.
              </p>
              {meta?.cancelUrl && (
                <a
                  href={meta.cancelUrl}
                  className="inline-block text-xs text-base-content/50 underline underline-offset-2"
                >
                  Need to cancel instead?
                </a>
              )}
            </div>
          </div>
        ) : !meta || !timezone ? (
          <div className="rounded-2xl border border-base-300 bg-base-200 p-10 text-center space-y-2">
            <span className="loading loading-spinner loading-md" />
            <p className="text-sm text-base-content/50">Loading…</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-base-300 bg-base-200 overflow-hidden shadow-sm">
            <div className="h-1.5" style={{ backgroundColor: brandColor }} />

            <div className="px-6 sm:px-8 py-6 border-b border-base-300">
              <p className="text-sm text-base-content/50 mb-1">Reschedule with</p>
              <h1 className="text-xl sm:text-2xl font-bold">{meta.organizer?.name}</h1>
              <p className="text-sm text-base-content/70 mt-1">{meta.booking.title}</p>
              <p className="text-xs text-base-content/45 flex items-center gap-1.5 mt-3">
                <ClockIcon />
                Current: {formatWhen(meta.booking.startTime, timezone)}
              </p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-base-content/40 mb-1.5">
                  Your timezone
                </label>
                <TimezoneSelect value={timezone} onChange={handleTimezoneChange} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-base sm:text-lg font-semibold">{monthLabel}</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!canGoPrevMonth}
                      onClick={() =>
                        setMonthCursor((c) =>
                          c.month === 0
                            ? { year: c.year - 1, month: 11 }
                            : { year: c.year, month: c.month - 1 }
                        )
                      }
                      className="btn btn-ghost btn-sm btn-square disabled:opacity-20"
                      aria-label="Previous month"
                    >
                      <ChevronIcon direction="left" />
                    </button>
                    <button
                      type="button"
                      disabled={!canGoNextMonth}
                      onClick={() =>
                        setMonthCursor((c) =>
                          c.month === 11
                            ? { year: c.year + 1, month: 0 }
                            : { year: c.year, month: c.month + 1 }
                        )
                      }
                      className="btn btn-ghost btn-sm btn-square disabled:opacity-20"
                      aria-label="Next month"
                    >
                      <ChevronIcon direction="right" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center mb-2">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <span
                      key={i}
                      className="text-[11px] sm:text-xs uppercase text-base-content/40 font-medium"
                    >
                      {d}
                    </span>
                  ))}
                </div>

                <div
                  className={`grid grid-cols-7 gap-1.5 sm:gap-2 transition-opacity ${
                    isLoadingCalendar ? "opacity-40" : "opacity-100"
                  }`}
                >
                  {weeks.flat().map((day, i) => {
                    if (!day) return <div key={`blank-${i}`} className="min-h-12 sm:min-h-14" />;

                    const inRange = day >= todayStr && day <= maxDateStr;
                    const status = availabilityMap.get(day);
                    const isSelected = day === selectedDate;
                    const isToday = day === todayStr;
                    const isClickable = inRange;
                    const hasSlots = isClickable && status === true && !isSelected;

                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={!isClickable}
                        onClick={() => {
                          setSelectedDate(day);
                          setSelectedSlot(null);
                          setError(null);
                        }}
                        style={
                          isSelected
                            ? { backgroundColor: brandColor, color: "white" }
                            : undefined
                        }
                        className={`relative min-h-12 sm:min-h-14 rounded-xl text-sm sm:text-base flex flex-col items-center justify-center transition-all border-2 ${
                          isSelected
                            ? "shadow-md font-semibold border-transparent"
                            : hasSlots
                              ? "border-success text-success hover:bg-success/10 active:scale-95 font-semibold"
                              : isClickable
                                ? "border-transparent hover:bg-base-300 active:scale-95 font-medium"
                                : "border-transparent text-base-content/25 cursor-default"
                        }`}
                      >
                        <span
                          className={
                            isToday && !isSelected ? "underline underline-offset-2" : ""
                          }
                        >
                          {dayOfMonth(day)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedDate && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-base-content/40 mb-3">
                    {weekdayShort(selectedDate)}, {monthYearLabel(selectedDate)}{" "}
                    {dayOfMonth(selectedDate)}
                  </p>

                  {isLoadingSlots ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-11 rounded-lg bg-base-300 animate-pulse" />
                      ))}
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-base-content/50 py-6 text-center">
                      No open times on this day. Try another date.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                      {slots.map((slot, i) => {
                        const active = selectedSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setSelectedSlot(slot);
                              setError(null);
                            }}
                            style={{
                              borderColor: brandColor,
                              ...(active
                                ? { backgroundColor: brandColor, color: "white" }
                                : { color: brandColor }),
                              animationDelay: `${Math.min(i, 12) * 30}ms`,
                            }}
                            className={`btn btn-outline btn-md h-11 min-h-11 active:scale-95 transition-transform ${
                              active ? "shadow-sm border-transparent" : ""
                            }`}
                            onMouseEnter={(e) => {
                              if (!active) {
                                e.currentTarget.style.backgroundColor = brandColor;
                                e.currentTarget.style.color = "white";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!active) {
                                e.currentTarget.style.backgroundColor = "";
                                e.currentTarget.style.color = brandColor;
                              }
                            }}
                          >
                            {formatSlotTime(slot, timezone)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {selectedSlot && (
                <div className="rounded-xl bg-base-300/40 px-4 py-3.5">
                  <p className="text-sm font-semibold">
                    {formatWhen(selectedSlot, timezone)}
                  </p>
                  <p className="text-xs text-base-content/40 mt-0.5 flex items-center gap-1">
                    <ClockIcon />
                    {formatTimezoneLabel(timezone)}
                  </p>
                </div>
              )}

              {error && <p className="text-sm text-error text-center">{error}</p>}

              <button
                type="button"
                disabled={!selectedSlot || isSaving}
                onClick={handleSubmit}
                style={
                  selectedSlot
                    ? { backgroundColor: brandColor, borderColor: brandColor }
                    : undefined
                }
                className={`btn btn-lg w-full ${
                  selectedSlot ? "text-white border-0" : "btn-disabled"
                }`}
              >
                {isSaving ? "Saving…" : "Confirm new time"}
              </button>

              {meta.cancelUrl && (
                <a
                  href={meta.cancelUrl}
                  className="block text-center text-sm text-base-content/45 hover:underline"
                >
                  Cancel this booking instead
                </a>
              )}
            </div>
          </div>
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
        <main className="min-h-screen flex items-center justify-center bg-base-100">
          <p className="text-sm text-base-content/50">Loading…</p>
        </main>
      }
    >
      <RescheduleInner id={id} />
    </Suspense>
  );
}
