"use client";

import { useEffect, useMemo, useState } from "react";

function dateToStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

// 產生 .ics 檔內容,讓使用者可以把預約直接加進自己的行事曆 app
function buildIcs({ title, description, location, startTime, endTime }) {
  const toIcsDate = (d) => new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const escapeText = (s) => (s || "").replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@booking`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(startTime)}`,
    `DTEND:${toIcsDate(endTime)}`,
    `SUMMARY:${escapeText(title)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : "",
    location ? `LOCATION:${escapeText(location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function downloadIcs(content, filename) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path
        fillRule="evenodd"
        d="M9.69 18.933c.09.043.194.043.284 0 .108-.052 2.751-1.35 4.786-3.463C16.15 13.981 17.5 11.955 17.5 9.5a7.5 7.5 0 10-15 0c0 2.455 1.35 4.481 2.74 5.97 2.035 2.113 4.678 3.411 4.786 3.463h-.336zM10 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function BookingWidget({
  username,
  slug,
  eventType,
  organizerName,
  organizerImage,
  brandColor = "#6366f1",
}) {
  const [mounted, setMounted] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [slots, setSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [step, setStep] = useState("select-time"); // select-time | details | success

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const viewerTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 14 天可選範圍,做成一排可以直接點的日期條
  const visibleDays = useMemo(
    () => [...Array(14)].map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const selectedDate = visibleDays[dayOffset];
  const dateStr = dateToStr(selectedDate);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      setIsLoadingSlots(true);
      try {
        const res = await fetch(
          `/api/public/availability?username=${encodeURIComponent(username)}&slug=${encodeURIComponent(slug)}&date=${dateStr}`
        );
        const data = await res.json();
        if (!cancelled) setSlots(res.ok ? data.slots || [] : []);
      } catch (e) {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setIsLoadingSlots(false);
      }
    }

    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [dateStr, username, slug]);

  async function handleConfirm(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          slug,
          startTime: selectedSlot,
          inviteeName: name,
          inviteeEmail: email,
          inviteeNotes: notes || undefined,
          inviteeTimezone: viewerTimezone,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to book this time");
        if (res.status === 409) {
          setStep("select-time");
          setSelectedSlot(null);
        }
        return;
      }

      setStep("success");
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAddToCalendar() {
    const end = new Date(new Date(selectedSlot).getTime() + eventType.duration * 60000);
    const ics = buildIcs({
      title: eventType.title,
      description: eventType.description,
      location: eventType.location,
      startTime: selectedSlot,
      endTime: end,
    });
    downloadIcs(ics, `${eventType.title.replace(/\s+/g, "-").toLowerCase()}.ics`);
  }

  if (!mounted) {
    return (
      <div className="rounded-2xl border border-base-300 bg-base-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-base-300 flex items-start gap-3">
          <span
            className="w-3 h-3 rounded-full mt-1 shrink-0"
            style={{ backgroundColor: eventType.color }}
          />
          <div>
            <p className="text-sm text-base-content/50">{organizerName}</p>
            <h1 className="text-xl font-bold">{eventType.title}</h1>
            {eventType.description && (
              <p className="text-sm text-base-content/60 mt-1">{eventType.description}</p>
            )}
            <p className="text-sm text-base-content/50 mt-1">
              {eventType.duration} min{eventType.location ? ` · ${eventType.location}` : ""}
            </p>
          </div>
        </div>
        <div className="p-6 space-y-3">
          <div className="h-14 rounded-lg bg-base-300 animate-pulse" />
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-base-300 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === "success") {
    const end = new Date(new Date(selectedSlot).getTime() + eventType.duration * 60000);

    return (
      <div className="rounded-2xl border border-base-300 bg-base-200 overflow-hidden animate-opacity">
        <div className="p-10 text-center space-y-3 border-b border-base-300">
          <div className="w-12 h-12 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto text-2xl animate-popup">
            ✓
          </div>
          <h2 className="text-xl font-bold">You&apos;re booked!</h2>
          <p className="text-base-content/60 text-sm">
            A confirmation email is on its way to {email}.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: eventType.color }}
            />
            <div>
              <p className="font-semibold text-sm">{eventType.title}</p>
              <p className="text-sm text-base-content/60">
                {new Date(selectedSlot).toLocaleString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                –{" "}
                {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="text-xs text-base-content/40 mt-0.5">{viewerTimezone}</p>
            </div>
          </div>

          <button type="button" onClick={handleAddToCalendar} className="btn btn-outline btn-sm w-full">
            Add to calendar (.ics)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-base-300 bg-base-200 overflow-hidden">
      {/* Header */}
      <div className="h-1.5" style={{ backgroundColor: eventType.color }} />
      <div className="px-6 py-6 border-b border-base-300">
        <div className="flex items-center gap-2.5 mb-4">
          {organizerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organizerImage}
              alt={organizerName}
              className="w-7 h-7 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: brandColor }}
            >
              {organizerName?.charAt(0) || "?"}
            </div>
          )}
          <p className="text-sm text-base-content/60">{organizerName}</p>
        </div>

        <h1 className="text-xl font-bold">{eventType.title}</h1>
        {eventType.description && (
          <p className="text-sm text-base-content/60 mt-1.5 leading-relaxed">
            {eventType.description}
          </p>
        )}

        <div className="flex items-center gap-4 mt-3 text-sm text-base-content/50">
          <span className="flex items-center gap-1.5">
            <ClockIcon />
            {eventType.duration} min
          </span>
          {eventType.location && (
            <span className="flex items-center gap-1.5">
              <PinIcon />
              {eventType.location}
            </span>
          )}
        </div>
      </div>

      {step === "select-time" && (
        <div key="select-time" className="p-6 space-y-5 animate-opacity">
          {/* 14天可橫向滑動的日期條 */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {visibleDays.map((day, i) => {
              const isSelected = i === dayOffset;
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setDayOffset(i)}
                  style={isSelected ? { backgroundColor: brandColor, color: "white" } : undefined}
                  className={`flex flex-col items-center justify-center w-12 h-14 rounded-lg shrink-0 transition-all hover:scale-105 active:scale-95 ${
                    isSelected ? "" : "bg-base-300/50 hover:bg-base-300 text-base-content"
                  }`}
                >
                  <span className="text-[10px] uppercase opacity-70">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <span className="text-sm font-semibold">
                    {day.getDate()}
                    {isToday && !isSelected && (
                      <span
                        className="block w-1 h-1 rounded-full mx-auto mt-0.5"
                        style={{ backgroundColor: brandColor }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 時區提示,避免對方誤會時間是主辦人時區 */}
          <p className="text-xs text-base-content/40 flex items-center gap-1">
            Times shown in your timezone ({viewerTimezone})
          </p>

          {isLoadingSlots ? (
            <div className="grid grid-cols-3 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-base-300 animate-pulse" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-base-content/50">No open times on this day.</p>
              {dayOffset < visibleDays.length - 1 && (
                <button
                  type="button"
                  onClick={() => setDayOffset((d) => Math.min(visibleDays.length - 1, d + 1))}
                  className="btn btn-ghost btn-sm"
                >
                  Try the next day →
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot, i) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => {
                    setSelectedSlot(slot);
                    setStep("details");
                    setError(null);
                  }}
                  style={{
                    borderColor: brandColor,
                    color: brandColor,
                    animationDelay: `${Math.min(i, 12) * 30}ms`,
                  }}
                  className="btn btn-outline btn-sm hover:text-white active:scale-95 transition-transform animate-opacity"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = brandColor)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                >
                  {new Date(slot).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "details" && selectedSlot && (
        <form onSubmit={handleConfirm} key="details" className="p-6 space-y-4 animate-appearFromRight">
          <button
            type="button"
            onClick={() => setStep("select-time")}
            className="text-sm text-base-content/50 hover:text-base-content flex items-center gap-1"
          >
            ← Back
          </button>

          <div className="rounded-lg bg-base-300/40 px-4 py-3">
            <p className="text-sm font-semibold">
              {new Date(selectedSlot).toLocaleString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <p className="text-xs text-base-content/40 mt-0.5">{viewerTimezone}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Anything you&apos;d like to share? (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="textarea textarea-bordered w-full"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{ backgroundColor: brandColor, borderColor: brandColor }}
            className="btn w-full text-white"
          >
            {isSubmitting ? "Booking…" : "Confirm booking"}
          </button>
        </form>
      )}
    </div>
  );
}
