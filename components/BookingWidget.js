"use client";

import { useEffect, useMemo, useState } from "react";
import TimezoneSelect from "@/components/TimezoneSelect";
import {
  addDaysToDateStr,
  dateStrInTimezone,
  formatTimezoneLabel,
} from "@/libs/timezone";

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

// dateStr 是一個單純的日曆日期(不含時區),用 UTC 錨定來取星期幾 / 月份等顯示用文字,
// 避免又牽扯進時區轉換造成日期跳動。
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

function formatSlotFullDate(iso, timeZone) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
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
  // 預約人自己選的時區,一開始自動偵測瀏覽器時區,但可以手動換
  const [timezone, setTimezone] = useState(null);
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

  useEffect(() => {
    setMounted(true);
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  function handleTimezoneChange(tz) {
    setTimezone(tz);
    // 換時區之後,原本選到的第幾天可能對不上了(日曆日跳動),回到今天最保險
    setDayOffset(0);
    setSelectedSlot(null);
  }

  // 「今天」是以預約人選的時區為準,不是伺服器或瀏覽器預設值
  const todayStr = useMemo(
    () => dateStrInTimezone(new Date(), timezone || "UTC"),
    [timezone]
  );

  // 14 天可選範圍,做成一排可以直接點的日期條(單純日曆日期字串,例如 "2026-08-03")
  const visibleDays = useMemo(
    () => [...Array(14)].map((_, i) => addDaysToDateStr(todayStr, i)),
    [todayStr]
  );

  const dateStr = visibleDays[dayOffset];

  useEffect(() => {
    if (!timezone) return;
    let cancelled = false;
    const controller = new AbortController();

    async function loadSlots() {
      setIsLoadingSlots(true);
      try {
        // 主辦人後台是用「他自己的時區」在算一天的起訖,跟預約人選的時區不一定對齊
        // (時差可能讓同一個時刻落在不同的日曆日)。所以查詢日期的前一天、當天、
        // 後一天都抓,再依「預約人選的時區」把時段過濾回真正對應到的那一天。
        const candidateDates = [
          addDaysToDateStr(dateStr, -1),
          dateStr,
          addDaysToDateStr(dateStr, 1),
        ];

        const results = await Promise.all(
          candidateDates.map((d) =>
            fetch(
              `/api/public/availability?username=${encodeURIComponent(username)}&slug=${encodeURIComponent(slug)}&date=${d}`,
              { signal: controller.signal }
            )
              .then((res) => (res.ok ? res.json() : { slots: [] }))
              .catch(() => ({ slots: [] }))
          )
        );

        const merged = new Map();
        for (const data of results) {
          for (const iso of data.slots || []) merged.set(iso, iso);
        }

        const filtered = [...merged.values()]
          .filter((iso) => dateStrInTimezone(new Date(iso), timezone) === dateStr)
          .sort((a, b) => new Date(a) - new Date(b));

        if (!cancelled) setSlots(filtered);
      } catch (e) {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setIsLoadingSlots(false);
      }
    }

    loadSlots();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dateStr, username, slug, timezone]);

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
          inviteeTimezone: timezone,
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
          <div className="h-10 rounded-lg bg-base-300 animate-pulse" />
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
          <div>
            <h2 className="text-lg font-bold">You&apos;re booked!</h2>
            <p className="text-sm text-base-content/60 mt-1">
              A confirmation has been sent to {email}
            </p>
          </div>
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
                {formatSlotFullDate(selectedSlot, timezone)}
                {" – "}
                {formatSlotTime(end.toISOString(), timezone)}
              </p>
              <p className="text-xs text-base-content/40 mt-0.5 flex items-center gap-1">
                <ClockIcon />
                {formatTimezoneLabel(timezone)}
              </p>
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
    <div className="rounded-2xl border border-base-300 bg-base-200 overflow-hidden shadow-sm">
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
          {/* 預約人自己選時區:所有日期、時段都會依這裡自動換算顯示 */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-base-content/40 mb-1.5">
              Your timezone
            </label>
            <TimezoneSelect value={timezone} onChange={handleTimezoneChange} />
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">{monthYearLabel(dateStr)}</p>

            {/* 14天可橫向滑動的日期條 */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {visibleDays.map((day, i) => {
                const isSelected = i === dayOffset;
                const isToday = day === todayStr;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setDayOffset(i);
                      setSelectedSlot(null);
                    }}
                    style={isSelected ? { backgroundColor: brandColor, color: "white" } : undefined}
                    className={`flex flex-col items-center justify-center w-12 h-14 rounded-lg shrink-0 transition-all hover:scale-105 active:scale-95 ${
                      isSelected
                        ? "shadow-md"
                        : "bg-base-300/50 hover:bg-base-300 text-base-content"
                    }`}
                  >
                    <span className="text-[10px] uppercase opacity-70">{weekdayShort(day)}</span>
                    <span className="text-sm font-semibold">
                      {dayOfMonth(day)}
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
          </div>

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
                  {formatSlotTime(slot, timezone)}
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
            <p className="text-sm font-semibold">{formatSlotFullDate(selectedSlot, timezone)}</p>
            <p className="text-xs text-base-content/40 mt-0.5 flex items-center gap-1">
              <ClockIcon />
              {formatTimezoneLabel(timezone)}
            </p>
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
