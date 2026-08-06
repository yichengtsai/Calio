"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog";

const DEFAULT_HOUR_START = 8;
const DEFAULT_HOUR_END = 18;
const HOUR_HEIGHT = 56;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AVAILABLE_TINT = "#6366f1"; // 可預約時段固定用這個顏色標示,不跟著活動類型變動,才不會忽隱忽現

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

function dateToStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function timeStrToHour(str) {
  const [h, m] = str.split(":").map(Number);
  return h + m / 60;
}

function hexToRgba(hex, alpha) {
  const h = hex?.replace("#", "") || "6366f1";
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatCountdown(target, now) {
  const diffMs = target - now;
  if (diffMs <= 0) return "starting now";
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "starting now";
  if (diffMin < 60) return `in ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}

export default function CalendarView() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [error, setError] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [now, setNow] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockForm, setBlockForm] = useState({
    title: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
  });
  const [isSavingBlock, setIsSavingBlock] = useState(false);
  const [blockError, setBlockError] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [dragCreate, setDragCreate] = useState(null); // { day, startHour, currentHour } 拖曳建立忙碌時段用

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadSchedule() {
    try {
      const res = await fetch("/api/schedule");
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      setError("Failed to load your schedule");
    }
  }

  useEffect(() => {
    loadSchedule();
    fetch("/api/availability")
      .then((res) => res.json())
      .then((data) => setAvailability(data.timeSlots || []))
      .catch(() => setAvailability([]));
  }, []);

  function handleCancel(item) {
    setConfirmState({
      title: `Cancel "${item.title}"?`,
      description: "This will notify the other person by email.",
      confirmLabel: "Cancel this",
      danger: true,
      onConfirm: () => doCancel(item),
    });
  }

  async function doCancel(item) {
    setIsCancelling(true);
    try {
      const endpoint =
        item.source === "booking" ? `/api/bookings/${item.id}` : `/api/events/${item.id}`;
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      setSelectedItem(null);
      toast.success("Cancelled — the other person has been notified");
      await loadSchedule();
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleApprove(item) {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to approve this booking");
        return;
      }
      setSelectedItem(null);
      toast.success("Approved");
      await loadSchedule();
    } finally {
      setIsCancelling(false);
    }
  }

  function handleDecline(item) {
    setConfirmState({
      title: `Decline the request from ${item.inviteeName}?`,
      confirmLabel: "Decline",
      danger: true,
      onConfirm: () => doDecline(item),
    });
  }

  async function doDecline(item) {
    setIsCancelling(true);
    try {
      await fetch(`/api/bookings/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "declined" }),
      });
      setSelectedItem(null);
      toast.success("Declined");
      await loadSchedule();
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleCreateBlock(e) {
    e.preventDefault();
    setBlockError(null);

    if (!blockForm.date || !blockForm.startTime || !blockForm.endTime) {
      setBlockError("Date, start time, and end time are required");
      return;
    }

    setIsSavingBlock(true);
    try {
      const startTime = new Date(`${blockForm.date}T${blockForm.startTime}:00`).toISOString();
      const endTime = new Date(`${blockForm.date}T${blockForm.endTime}:00`).toISOString();

      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: blockForm.title || "Busy",
          notes: blockForm.notes || undefined,
          startTime,
          endTime,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setBlockError(data.error || "Failed to save");
        return;
      }

      setShowBlockForm(false);
      setBlockForm({ title: "", date: "", startTime: "09:00", endTime: "10:00", notes: "" });
      toast.success("Added to your calendar");
      await loadSchedule();
    } catch (err) {
      setBlockError("Something went wrong. Please try again.");
    } finally {
      setIsSavingBlock(false);
    }
  }

  function handleDeleteBlock(item) {
    setConfirmState({
      title: `Remove "${item.title}" from your calendar?`,
      confirmLabel: "Remove",
      danger: true,
      onConfirm: () => doDeleteBlock(item),
    });
  }

  async function doDeleteBlock(item) {
    setIsCancelling(true);
    try {
      await fetch(`/api/blocks/${item.id}`, { method: "DELETE" });
      setSelectedItem(null);
      toast.success("Removed");
      await loadSchedule();
    } finally {
      setIsCancelling(false);
    }
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const weekStart = useMemo(
    () => addDays(startOfWeek(new Date()), weekOffset * 7),
    [weekOffset]
  );
  const days = useMemo(() => [...Array(7)].map((_, i) => addDays(weekStart, i)), [weekStart]);

  const stats = useMemo(() => {
    if (!items) return null;

    const realNow = now;
    const realWeekStart = startOfWeek(realNow);
    const realWeekEnd = addDays(realWeekStart, 7);
    const monthStart = new Date(realNow.getFullYear(), realNow.getMonth(), 1);
    const monthEnd = new Date(realNow.getFullYear(), realNow.getMonth() + 1, 1);

    let todayCount = 0;
    let nextToday = null;
    let weekCount = 0;
    let weekMinutes = 0;
    let monthCount = 0;
    let pendingCount = 0;

    items.forEach((item) => {
      const start = new Date(item.startTime);
      const durationMin = (new Date(item.endTime) - start) / 60000;
      if (item.status === "pending") pendingCount += 1;

      if (isSameDay(start, realNow)) {
        todayCount += 1;
        if (start > realNow && (!nextToday || start < nextToday)) nextToday = start;
      }
      if (start >= realWeekStart && start < realWeekEnd) {
        weekCount += 1;
        weekMinutes += durationMin;
      }
      if (start >= monthStart && start < monthEnd) monthCount += 1;
    });

    return {
      todayCount,
      nextToday,
      weekCount,
      weekHours: Math.round((weekMinutes / 60) * 10) / 10,
      monthCount,
      pendingCount,
    };
  }, [items, now]);

  const hourBounds = useMemo(() => {
    if (!items) return { hourStart: DEFAULT_HOUR_START, hourEnd: DEFAULT_HOUR_END };
    const itemHours = items.flatMap((item) => [
      new Date(item.startTime).getHours(),
      new Date(item.endTime).getHours() + (new Date(item.endTime).getMinutes() > 0 ? 1 : 0),
    ]);
    return {
      hourStart: Math.min(DEFAULT_HOUR_START, ...itemHours),
      hourEnd: Math.max(DEFAULT_HOUR_END, ...itemHours),
    };
  }, [items]);

  // 拖曳中,追蹤滑鼠移動/放開,算出對應的時間(15 分鐘吸附),放開後把 Add 表單帶好時間打開
  useEffect(() => {
    if (!dragCreate) return;

    function clampHour(h) {
      return Math.min(hourBounds.hourEnd, Math.max(hourBounds.hourStart, h));
    }

    function handleMouseMove(e) {
      const hour = clampHour(hourBounds.hourStart + (e.clientY - dragCreate.top) / HOUR_HEIGHT);
      setDragCreate((prev) => (prev ? { ...prev, currentHour: hour } : prev));
    }

    function handleMouseUp() {
      setDragCreate((prev) => {
        if (!prev) return null;
        const lo = Math.min(prev.startHour, prev.currentHour);
        const hi = Math.max(prev.startHour, prev.currentHour);
        if (hi - lo >= 0.2) {
          // 拖出至少 ~12 分鐘才算數,避免單純點擊被誤判成拖曳
          const snap = (h) => {
            const s = Math.round(h * 4) / 4;
            const hh = Math.floor(s);
            const mm = Math.round((s - hh) * 60);
            return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
          };
          setBlockForm((f) => ({
            ...f,
            date: dateToStr(prev.day),
            startTime: snap(lo),
            endTime: snap(hi),
          }));
          setShowBlockForm(true);
        }
        return null;
      });
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragCreate?.top, dragCreate?.day, hourBounds.hourStart, hourBounds.hourEnd]);

  if (error) return <p className="text-sm text-error">{error}</p>;

  if (!mounted || items === null) {
    return <div className="h-96 rounded-2xl bg-base-200 animate-pulse" />;
  }

  const { hourStart, hourEnd } = hourBounds;
  const totalHours = hourEnd - hourStart;

  function itemsForDay(day) {
    return items.filter((item) => isSameDay(new Date(item.startTime), day));
  }

  function availabilityForDay(day) {
    return availability.filter((rule) => rule.dayOfWeek === day.getDay());
  }

  function handleDayMouseDown(e, day) {
    if (e.button !== 0) return; // 只認滑鼠左鍵
    if (e.target.closest("button")) return; // 點到既有行程色塊就不要觸發拖曳建立
    const rect = e.currentTarget.getBoundingClientRect();
    const hour = hourStart + (e.clientY - rect.top) / HOUR_HEIGHT;
    setDragCreate({ day, top: rect.top, startHour: hour, currentHour: hour });
  }

  function blockGeometry(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

    const top = Math.max(0, (startHour - hourStart) * HOUR_HEIGHT);
    const heightPx = Math.max(20, (endHour - startHour) * HOUR_HEIGHT);

    return { top, heightPx };
  }

  return (
    <div className="space-y-4">
      {/* 統計卡片 */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-base-300 bg-base-200 px-4 py-2.5">
          <p className="text-xs text-base-content/50">Today</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold">{stats.todayCount}</p>
            <span className="text-xs text-base-content/40">
              {stats.todayCount === 1 ? "meeting" : "meetings"}
            </span>
          </div>
          <p className="text-[11px] text-base-content/40 mt-0.5">
            {stats.nextToday
              ? `Next meeting ${formatCountdown(stats.nextToday, now)}`
              : stats.todayCount > 0
                ? "All done for today"
                : "Nothing scheduled"}
          </p>
        </div>

        <div className="rounded-xl border border-base-300 bg-base-200 px-4 py-2.5">
          <p className="text-xs text-base-content/50">This week</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold">{stats.weekCount}</p>
            <span className="text-xs text-base-content/40">· {stats.weekHours}h</span>
          </div>
          <p className="text-[11px] text-base-content/40 mt-0.5">across 7 days</p>
        </div>

        <div className="rounded-xl border border-base-300 bg-base-200 px-4 py-2.5 relative">
          <p className="text-xs text-base-content/50">This month</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold">{stats.monthCount}</p>
            <span className="text-xs text-base-content/40">
              {stats.monthCount === 1 ? "meeting" : "meetings"}
            </span>
          </div>
          {stats.pendingCount > 0 ? (
            <p className="text-[11px] text-warning font-medium mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              {stats.pendingCount} pending
            </p>
          ) : (
            <p className="text-[11px] text-base-content/40 mt-0.5">All caught up</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="btn btn-ghost btn-sm"
          >
            ← Prev
          </button>
          <button type="button" onClick={() => setWeekOffset(0)} className="btn btn-ghost btn-sm">
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="btn btn-ghost btn-sm"
          >
            Next →
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-base-content/80">
            {weekStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <span className="hidden md:inline text-[11px] text-base-content/40">
            Tip: drag on the grid to block off time
          </span>
          <button
            type="button"
            onClick={() => setShowBlockForm(true)}
            className="btn btn-primary btn-sm"
          >
            + Add
          </button>
        </div>
      </div>

      <div
        key={weekStart.toISOString()}
        className="rounded-2xl border border-base-300 bg-base-200 overflow-x-auto animate-opacity"
      >
        <div className="min-w-[720px]">
          {/* 日期標頭 */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-base-300">
            <div />
            {days.map((day) => {
              const isToday = isSameDay(day, now);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={day.toISOString()}
                  className={`px-2 py-3 text-center border-l ${
                    isToday
                      ? "bg-primary/15 border-l-[3px] border-l-primary"
                      : isWeekend
                        ? "bg-base-300/20 border-base-300"
                        : "border-base-300"
                  }`}
                >
                  <p className="text-xs text-base-content/50">{DAY_LABELS[day.getDay()]}</p>
                  <p className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                    {day.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* 時間格線 + 事件色塊 */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)]">
            <div>
              {[...Array(totalHours)].map((_, i) => (
                <div
                  key={i}
                  style={{ height: `${HOUR_HEIGHT}px` }}
                  className="text-[11px] font-medium text-base-content/45 text-right pr-2 -translate-y-2"
                >
                  {String((hourStart + i) % 24).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayItems = itemsForDay(day);
              const dayRules = availabilityForDay(day);
              const isToday = isSameDay(day, now);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              return (
                <div
                  key={day.toISOString()}
                  onMouseDown={(e) => handleDayMouseDown(e, day)}
                  className={`relative border-l select-none cursor-crosshair ${
                    isToday
                      ? "bg-primary/[0.04] border-l-[3px] border-l-primary"
                      : isWeekend
                        ? "bg-base-300/10 border-base-300"
                        : "border-base-300"
                  }`}
                  style={{ height: `${totalHours * HOUR_HEIGHT}px` }}
                >
                  {/* 拖曳中的預覽色塊,放開滑鼠後會用這段時間帶出 Add 表單 */}
                  {dragCreate && isSameDay(dragCreate.day, day) && (
                    <div
                      className="absolute left-0.5 right-0.5 rounded-md bg-primary/25 border-2 border-dashed border-primary pointer-events-none z-30"
                      style={{
                        top: `${(Math.min(dragCreate.startHour, dragCreate.currentHour) - hourStart) * HOUR_HEIGHT}px`,
                        height: `${Math.max(4, Math.abs(dragCreate.currentHour - dragCreate.startHour) * HOUR_HEIGHT)}px`,
                      }}
                    />
                  )}

                  {/* 可預約時段:淺色底 + 虛線邊框,取代原本幾乎看不見的深綠色 */}
                  {dayRules.map((rule, i) => (
                    <div
                      key={i}
                      className="absolute left-0.5 right-0.5 rounded-sm border border-dashed group"
                      style={{
                        top: `${Math.max(0, (timeStrToHour(rule.startTime) - hourStart) * HOUR_HEIGHT)}px`,
                        height: `${(timeStrToHour(rule.endTime) - timeStrToHour(rule.startTime)) * HOUR_HEIGHT}px`,
                        backgroundColor: hexToRgba(AVAILABLE_TINT, 0.07),
                        borderColor: hexToRgba(AVAILABLE_TINT, 0.35),
                      }}
                    >
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: AVAILABLE_TINT }}
                      >
                        Available
                      </span>
                    </div>
                  ))}

                  {[...Array(totalHours)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-base-300/60"
                      style={{ top: `${i * HOUR_HEIGHT}px` }}
                    />
                  ))}

                  {isToday && now.getHours() >= hourStart && now.getHours() < hourEnd && (
                    <div
                      className="absolute left-0 right-0 z-10 flex items-center"
                      style={{
                        top: `${(now.getHours() + now.getMinutes() / 60 - hourStart) * HOUR_HEIGHT}px`,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-error -ml-0.75" />
                      <span className="flex-1 border-t-2 border-error" />
                    </div>
                  )}

                  {/* 事件色塊:確認的用實心底+左色條,待確認的用虛線框區分 */}
                  {dayItems.map((item) => {
                    const { top, heightPx } = blockGeometry(item.startTime, item.endTime);
                    const isPending = item.status === "pending";
                    const showTime = heightPx >= 32;
                    const showSubtitle = heightPx >= 50 && item.subtitle;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className={`absolute left-1.5 right-1.5 rounded-lg pl-2.5 pr-2 py-1 overflow-hidden text-left cursor-pointer transition-all hover:shadow-md hover:z-20 ${
                          isPending ? "border-2 border-dashed" : "border-l-[3px]"
                        }`}
                        style={{
                          top: `${top}px`,
                          height: `${heightPx}px`,
                          backgroundColor: hexToRgba(item.color, isPending ? 0.08 : 0.14),
                          borderColor: item.color,
                        }}
                        title={`${item.title}${item.subtitle ? ` — ${item.subtitle}` : ""}${isPending ? " (pending approval)" : ""}`}
                      >
                        <p
                          className="font-semibold truncate text-[11px] leading-tight"
                          style={{ color: item.color }}
                        >
                          {item.title}
                        </p>
                        {showTime && (
                          <p className="truncate text-[10px] leading-tight text-base-content/55">
                            {new Date(item.startTime).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {isPending && " · Pending"}
                          </p>
                        )}
                        {showSubtitle && (
                          <p className="truncate text-[10px] leading-tight text-base-content/40">
                            {item.subtitle}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-opacity"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-base-100 border border-base-300 rounded-2xl max-w-sm w-full p-6 space-y-4 animate-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: selectedItem.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg">
                  {selectedItem.title}
                  {selectedItem.status === "pending" && (
                    <span className="badge badge-warning badge-sm ml-2 align-middle">
                      Pending
                    </span>
                  )}
                </p>
                <p className="text-sm text-base-content/60 mt-0.5">
                  {new Date(selectedItem.startTime).toLocaleString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  –{" "}
                  {new Date(selectedItem.endTime).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-base-content/40 hover:text-base-content shrink-0"
              >
                ✕
              </button>
            </div>

            {selectedItem.location && (
              <p className="text-sm">
                <span className="text-base-content/50">Location: </span>
                {selectedItem.location}
              </p>
            )}

            {selectedItem.source === "booking" ? (
              <div className="rounded-lg bg-base-200 px-4 py-3 space-y-1">
                <p className="text-sm font-medium">{selectedItem.inviteeName}</p>
                <p className="text-xs text-base-content/50">{selectedItem.inviteeEmail}</p>
                {selectedItem.inviteeNotes && (
                  <p className="text-xs text-base-content/60 italic mt-2">
                    &ldquo;{selectedItem.inviteeNotes}&rdquo;
                  </p>
                )}
              </div>
            ) : selectedItem.source === "block" ? (
              selectedItem.notes && (
                <p className="text-sm text-base-content/70">{selectedItem.notes}</p>
              )
            ) : (
              <div className="space-y-1.5">
                {selectedItem.description && (
                  <p className="text-sm text-base-content/70">{selectedItem.description}</p>
                )}
                {selectedItem.participants?.length > 0 && (
                  <div className="rounded-lg bg-base-200 px-4 py-3 space-y-1.5">
                    {selectedItem.participants.map((p, i) => (
                      <p key={i} className="text-xs">
                        <span className="font-medium">{p.name || p.email}</span>
                        {p.name && <span className="text-base-content/40"> · {p.email}</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedItem.source === "block" ? (
              <button
                type="button"
                onClick={() => handleDeleteBlock(selectedItem)}
                disabled={isCancelling}
                className="btn btn-outline btn-error btn-sm w-full"
              >
                {isCancelling ? "Removing…" : "Remove"}
              </button>
            ) : selectedItem.status === "pending" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleApprove(selectedItem)}
                  disabled={isCancelling}
                  className="btn btn-success btn-sm flex-1"
                >
                  {isCancelling ? "Working…" : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDecline(selectedItem)}
                  disabled={isCancelling}
                  className="btn btn-ghost btn-sm flex-1"
                >
                  Decline
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleCancel(selectedItem)}
                disabled={isCancelling}
                className="btn btn-outline btn-error btn-sm w-full"
              >
                {isCancelling ? "Cancelling…" : "Cancel this"}
              </button>
            )}
          </div>
        </div>
      )}

      {showBlockForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-opacity"
          onClick={() => setShowBlockForm(false)}
        >
          <form
            onSubmit={handleCreateBlock}
            className="bg-base-100 border border-base-300 rounded-2xl max-w-sm w-full p-6 space-y-4 animate-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="font-bold text-lg">Block your time</h2>
              <button
                type="button"
                onClick={() => setShowBlockForm(false)}
                className="text-base-content/40 hover:text-base-content"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-base-content/50 -mt-2">
              For your own personal time — nobody is invited, and this time won&apos;t show up as available on your booking page.
            </p>

            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-1">Title</label>
              <input
                type="text"
                value={blockForm.title}
                onChange={(e) => setBlockForm((f) => ({ ...f, title: e.target.value }))}
                className="input input-bordered input-sm w-full"
                placeholder="Busy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-1">Date</label>
              <input
                type="date"
                required
                value={blockForm.date}
                onChange={(e) => setBlockForm((f) => ({ ...f, date: e.target.value }))}
                className="input input-bordered input-sm w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-base-content/80 mb-1">Start</label>
                <input
                  type="time"
                  required
                  value={blockForm.startTime}
                  onChange={(e) => setBlockForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="input input-bordered input-sm w-full"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-base-content/80 mb-1">End</label>
                <input
                  type="time"
                  required
                  value={blockForm.endTime}
                  onChange={(e) => setBlockForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="input input-bordered input-sm w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={blockForm.notes}
                onChange={(e) => setBlockForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="textarea textarea-bordered textarea-sm w-full"
              />
            </div>

            {blockError && <p className="text-sm text-error">{blockError}</p>}

            <button type="submit" disabled={isSavingBlock} className="btn btn-primary btn-sm w-full">
              {isSavingBlock ? "Saving…" : "Add to calendar"}
            </button>
          </form>
        </div>
      )}

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
