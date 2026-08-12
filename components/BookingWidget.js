"use client";

import { useEffect, useMemo, useState } from "react";
import TimezoneSelect from "@/components/TimezoneSelect";
import {
  addDaysToDateStr,
  dateStrInTimezone,
  formatTimezoneLabel,
} from "@/libs/timezone";

// 最多可以往未來看幾天——目前只是前端的顯示上限，
// 如果你的 EventType 本身有設定「最多提前幾天可預約」，記得把這個值對齊過去。
const MAX_ADVANCE_DAYS = 60;

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

// 給定某年某月(0-indexed month),排出月曆格子(週日開頭),
// 月初/月底補 null 讓格子對齊星期幾。
function buildCalendarWeeks(year, month) {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
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

function ChevronIcon({ direction = "left" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
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
  const [monthCursor, setMonthCursor] = useState(null); // { year, month } — month 0-indexed
  const [selectedDate, setSelectedDate] = useState(null);
  // 原始時段資料快取:dateStr -> [ISO string, ...]。用整月為單位一次向後端要,
  // 之後不管是月曆上的圓點/綠框,還是點某天展開的時段清單,都是從這份快取
  // 直接算出來(UTC 時間戳跟時區無關),換時區、點選日期都不用再打 API。
  const [rawSlotsByDate, setRawSlotsByDate] = useState(new Map());
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [step, setStep] = useState("select-time"); // select-time | details | success
  // 預約成功後,後端回傳的 booking 會帶 id + cancelToken(跟確認信裡取消連結用的是同一組),
  // 存起來才能在完成畫面上直接顯示取消連結,不用讓客戶只能從信箱裡找
  const [confirmedBooking, setConfirmedBooking] = useState(null);

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
    // 原始時段資料(UTC 時間戳)跟時區無關,不用清快取——換時區只是重新
    // 用新時區去篩選/顯示同一份資料,所以這裡不用再重新打 API。
    setSelectedDate(null);
    setSelectedSlot(null);
  }

  // 「今天」是以預約人選的時區為準,不是伺服器或瀏覽器預設值
  const todayStr = useMemo(
    () => dateStrInTimezone(new Date(), timezone || "UTC"),
    [timezone]
  );
  const maxDateStr = useMemo(
    () => (todayStr ? addDaysToDateStr(todayStr, MAX_ADVANCE_DAYS) : null),
    [todayStr]
  );

  // 一旦知道「今天」是哪一天,月曆預設停在今天所在的月份
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
        ? new Date(Date.UTC(monthCursor.year, monthCursor.month, 1)).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })
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

  // 整個月只打一次 API(而不是每天各打一次):後端會把該月「前一天到後一天」
  // 範圍內每一天的原始時段(UTC ISO字串)一次算好回傳,月曆一出現就能同步標示綠框,
  // 不用等 30 幾支請求一支一支跑完。已經抓過的月份不會重複打。
  useEffect(() => {
    if (!monthCursor) return;
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
          Object.entries(data.slotsByDate || {}).forEach(([d, isoList]) => next.set(d, isoList));
          return next;
        });
      })
      .catch(() => {})
      .finally(() => setIsLoadingCalendar(false));

    return () => controller.abort();
  }, [monthCursor, username, slug]);

  // 月曆上每一天要不要加綠框:直接從已經抓好的整月快取算,不用再打 API。
  // 跟原本邏輯一樣,合併「前一天、當天、後一天」的原始時段再依訪客時區篩選,
  // 是為了對齊主辦人時區跟訪客時區不同時,日曆日的邊界不會對不上。
  const availabilityMap = useMemo(() => {
    const map = new Map();
    weeks.flat().forEach((day) => {
      if (!day) return;
      const candidateDates = [addDaysToDateStr(day, -1), day, addDaysToDateStr(day, 1)];
      const allLoaded = candidateDates.every((d) => rawSlotsByDate.has(d));
      if (!allLoaded) return; // 還沒抓回來,先不標記(視覺上就是尚未有綠框)

      const merged = new Map();
      candidateDates.forEach((d) => (rawSlotsByDate.get(d) || []).forEach((iso) => merged.set(iso, iso)));
      const hasSlotsForDay = [...merged.values()].some(
        (iso) => dateStrInTimezone(new Date(iso), timezone) === day
      );
      map.set(day, hasSlotsForDay);
    });
    return map;
  }, [weeks, rawSlotsByDate, timezone]);

  // 選定某一天之後的時段清單,一樣直接從快取算,不用再打 API。
  const selectedDateSlots = useMemo(() => {
    if (!selectedDate || !timezone) return null;
    const candidateDates = [
      addDaysToDateStr(selectedDate, -1),
      selectedDate,
      addDaysToDateStr(selectedDate, 1),
    ];
    const allLoaded = candidateDates.every((d) => rawSlotsByDate.has(d));
    if (!allLoaded) return null; // 還在等整月資料回來

    const merged = new Map();
    candidateDates.forEach((d) => (rawSlotsByDate.get(d) || []).forEach((iso) => merged.set(iso, iso)));

    return [...merged.values()]
      .filter((iso) => dateStrInTimezone(new Date(iso), timezone) === selectedDate)
      .sort((a, b) => new Date(a) - new Date(b));
  }, [selectedDate, rawSlotsByDate, timezone]);

  const slots = selectedDateSlots || [];
  const isLoadingSlots = !!selectedDate && selectedDateSlots === null;

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

      setConfirmedBooking({ id: data.booking.id, cancelToken: data.booking.cancelToken });
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
          <div className="h-64 rounded-lg bg-base-300 animate-pulse" />
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

          {confirmedBooking && (
            <div className="flex flex-col items-center gap-1.5">
              <a
                href={`/booking/${confirmedBooking.id}/reschedule?token=${confirmedBooking.cancelToken}`}
                className="text-sm text-primary hover:underline underline-offset-2"
              >
                Reschedule this booking
              </a>
              <a
                href={`/booking/${confirmedBooking.id}/cancel?token=${confirmedBooking.cancelToken}`}
                className="text-sm text-base-content/50 hover:text-base-content underline underline-offset-2"
              >
                Cancel this booking
              </a>
            </div>
          )}
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

          {/* 月曆 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">{monthLabel}</p>
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
                  className="btn btn-ghost btn-xs btn-square disabled:opacity-20"
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
                  className="btn btn-ghost btn-xs btn-square disabled:opacity-20"
                  aria-label="Next month"
                >
                  <ChevronIcon direction="right" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i} className="text-[10px] uppercase text-base-content/40">
                  {d}
                </span>
              ))}
            </div>

            <div
              className={`grid grid-cols-7 gap-1 transition-opacity ${
                isLoadingCalendar ? "opacity-40" : "opacity-100"
              }`}
            >
              {weeks.flat().map((day, i) => {
                if (!day) return <div key={`blank-${i}`} />;

                const inRange = day >= todayStr && day <= maxDateStr;
                // status 只當作視覺提示用,不拿來決定能不能點——精準的可預約時段
                // 一律等使用者真的點下去之後,用三天合併過濾的邏輯去問,才是準的。
                const status = availabilityMap.get(day); // undefined(還沒抓到/超出範圍) | true | false
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
                    }}
                    style={{
                      ...(isSelected ? { backgroundColor: brandColor, color: "white" } : undefined),
                    }}
                    className={`relative aspect-square rounded-lg text-sm flex flex-col items-center justify-center transition-all border ${
                      isSelected
                        ? "shadow-md font-semibold border-transparent"
                        : hasSlots
                        ? "border-success text-success hover:bg-success/10 active:scale-95 font-semibold"
                        : isClickable
                        ? "border-transparent hover:bg-base-300 active:scale-95 font-medium"
                        : "border-transparent text-base-content/25 cursor-default"
                    }`}
                  >
                    <span className={isToday && !isSelected ? "underline underline-offset-2" : ""}>
                      {dayOfMonth(day)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 選定日期後,展開當天的時段 */}
          {selectedDate && (
            <div className="animate-appearFromRight">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/40 mb-2">
                {weekdayShort(selectedDate)}, {monthYearLabel(selectedDate)} {dayOfMonth(selectedDate)}
              </p>

              {isLoadingSlots ? (
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 rounded-lg bg-base-300 animate-pulse" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-base-content/50 py-4 text-center">
                  No open times on this day.
                </p>
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
