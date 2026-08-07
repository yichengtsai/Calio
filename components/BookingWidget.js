"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [availabilityMap, setAvailabilityMap] = useState(new Map()); // dateStr -> "loading" | true | false
  // 記錄「已經問過/正在問」的日期——用 ref 而不是丟進 availabilityMap state 本身去判斷,
  // 是因為如果拿 availabilityMap 當 effect 的依賴,setAvailabilityMap(標成 loading) 一觸發
  // re-render,effect 依賴變了又會馬上重跑一次,連帶把上一輪剛發出去、還沒回來的 fetch
  // 用同一個 controller.abort() 砍掉,導致 Network 分頁一堆「已取消」、每天永遠查不到時段。
  const checkedDatesRef = useRef(new Set());
  const [slots, setSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
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
    // 換時區之後,日曆的月份格線、每天的可預約狀態都要重算,清快取最保險
    setAvailabilityMap(new Map());
    checkedDatesRef.current = new Set();
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

  // 月曆上輕量標記「這天有沒有空位」——每天各打一次 availability API,
  // 不做時區邊界的精準校正(那個留給使用者實際點下去那天再算),純粹當作視覺提示。
  useEffect(() => {
    if (!monthCursor || !timezone || !todayStr) return;
    const controller = new AbortController();

    const daysToCheck = weeks
      .flat()
      .filter((d) => d && d >= todayStr && d <= maxDateStr && !checkedDatesRef.current.has(d));

    if (daysToCheck.length === 0) return;

    // 馬上標記成「已經在問了」,靠 ref 記錄、不透過 state,避免觸發這個 effect 自己重跑
    daysToCheck.forEach((d) => checkedDatesRef.current.add(d));

    setAvailabilityMap((prev) => {
      const next = new Map(prev);
      daysToCheck.forEach((d) => next.set(d, "loading"));
      return next;
    });

    // 跟使用者實際點下去查時段時用同一套邏輯:每天都要抓「前一天、當天、後一天」
    // 合併後再依訪客自己的時區過濾,圓點提示才會跟點進去看到的結果一致,
    // 不會出現「有綠點但點進去卻是空的」這種時區邊界沒對齊的狀況。
    // 相鄰兩天需要的候選日期會重疊,用 Set 去重複,呼叫量不會變成 3 倍。
    const rawDatesNeeded = new Set();
    daysToCheck.forEach((d) => {
      rawDatesNeeded.add(addDaysToDateStr(d, -1));
      rawDatesNeeded.add(d);
      rawDatesNeeded.add(addDaysToDateStr(d, 1));
    });

    Promise.all(
      [...rawDatesNeeded].map((d) =>
        fetch(
          `/api/public/availability?username=${encodeURIComponent(username)}&slug=${encodeURIComponent(slug)}&date=${d}`,
          { signal: controller.signal }
        )
          .then((res) => (res.ok ? res.json() : { slots: [] }))
          .then((data) => [d, data.slots || []])
          .catch(() => [d, []])
      )
    ).then((results) => {
      const rawByDate = new Map(results);

      setAvailabilityMap((prev) => {
        const next = new Map(prev);
        daysToCheck.forEach((d) => {
          const merged = new Map();
          [addDaysToDateStr(d, -1), d, addDaysToDateStr(d, 1)].forEach((candidateDate) => {
            (rawByDate.get(candidateDate) || []).forEach((iso) => merged.set(iso, iso));
          });

          const hasSlotsForDay = [...merged.values()].some(
            (iso) => dateStrInTimezone(new Date(iso), timezone) === d
          );
          next.set(d, hasSlotsForDay);
        });
        return next;
      });
    });

    return () => controller.abort();
  }, [monthCursor, timezone, todayStr, maxDateStr, username, slug, weeks]);

  // 選定某一天之後,才做精準查詢:主辦人後台是用「他自己的時區」算一天的起訖,
  // 跟預約人選的時區不一定對齊(時差可能讓同一個時刻落在不同的日曆日)。
  // 所以查詢日期的前一天、當天、後一天都抓,再依「預約人選的時區」把時段過濾回真正對應到的那一天。
  useEffect(() => {
    if (!selectedDate || !timezone) return;
    let cancelled = false;
    const controller = new AbortController();

    async function loadSlots() {
      setIsLoadingSlots(true);
      try {
        const candidateDates = [
          addDaysToDateStr(selectedDate, -1),
          selectedDate,
          addDaysToDateStr(selectedDate, 1),
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
          .filter((iso) => dateStrInTimezone(new Date(iso), timezone) === selectedDate)
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
  }, [selectedDate, username, slug, timezone]);

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

            <div className="grid grid-cols-7 gap-1">
              {weeks.flat().map((day, i) => {
                if (!day) return <div key={`blank-${i}`} />;

                const inRange = day >= todayStr && day <= maxDateStr;
                // status 只當作視覺提示用,不拿來決定能不能點——精準的可預約時段
                // 一律等使用者真的點下去之後,用三天合併過濾的邏輯去問,才是準的。
                const status = availabilityMap.get(day); // undefined | "loading" | true | false
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
                      ...(hasSlots
                        ? { borderColor: brandColor, boxShadow: `inset 0 0 0 1px ${brandColor}` }
                        : undefined),
                    }}
                    className={`relative aspect-square rounded-lg text-sm flex flex-col items-center justify-center transition-all border ${
                      isSelected
                        ? "shadow-md font-semibold border-transparent"
                        : hasSlots
                        ? "hover:bg-base-300 active:scale-95 font-semibold"
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
