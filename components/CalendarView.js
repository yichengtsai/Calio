"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog";

const DEFAULT_HOUR_START = 8;
const DEFAULT_HOUR_END = 18;
const HOUR_HEIGHT = 56;

function toLocalDateInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MEETING_COLOR_PRESETS = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AVAILABLE_TINT = "#6366f1"; // 可預約時段固定用這個顏色標示,不跟著活動類型變動,才不會忽隱忽現

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 產生月曆格子用的 42 天(6 週 x 7 天),從包含 1 號那週的週日開始,
// 這樣月頭月尾露出的前後月份日期才會補滿整個矩形網格
function monthGridDays(monthDate) {
  const gridStart = startOfWeek(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  return [...Array(42)].map((_, i) => addDays(gridStart, i));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

function freeSegmentsForDay(day, dayRules, dayItems, hourStart, hourEnd) {
  // dayRules: availability windows; dayItems: busy blocks on calendar
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const segments = [];
  for (const rule of dayRules) {
    const [sh, sm] = String(rule.startTime || "09:00").split(":").map(Number);
    const [eh, em] = String(rule.endTime || "17:00").split(":").map(Number);
    let windows = [[sh + sm / 60, eh + em / 60]];
    for (const item of dayItems) {
      const s = new Date(item.startTime);
      const e = new Date(item.endTime);
      if (!isSameDay(s, day) && !isSameDay(e, day)) continue;
      const startH = s.getHours() + s.getMinutes() / 60;
      const endH = e.getHours() + e.getMinutes() / 60;
      const next = [];
      for (const [ws, we] of windows) {
        if (endH <= ws || startH >= we) {
          next.push([ws, we]);
        } else {
          if (startH > ws) next.push([ws, Math.max(ws, startH)]);
          if (endH < we) next.push([Math.min(we, endH), we]);
        }
      }
      windows = next.filter(([a, b]) => b - a >= 0.25);
    }
    for (const [a, b] of windows) {
      const from = Math.max(a, hourStart);
      const to = Math.min(b, hourEnd);
      if (to > from) segments.push({ startHour: from, endHour: to });
    }
  }
  return segments;
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
  const [view, setView] = useState("week"); // "day" | "week" | "month" | "year"
  // 每種顯示方式各自記住自己的位置,切換 view 時不會跳掉之前瀏覽到哪裡
  const [dayOffset, setDayOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [now, setNow] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null); // item being edited in modal
  const [editForm, setEditForm] = useState({
    title: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
    location: "",
    color: "#0ea5e9",
    useGoogleMeet: false,
    participants: [{ email: "", name: "" }],
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  // createKind: "block" = 個人忙碌, "meeting" = 會議(可邀請人)
  const [createKind, setCreateKind] = useState("block");
  const [blockForm, setBlockForm] = useState({
    title: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
    location: "",
    color: "#0ea5e9",
    useGoogleMeet: true,
    participants: [{ email: "", name: "" }],
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

  function findLocalConflicts(startIso, endIso) {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    return (items || []).filter((item) => {
      if (item.status === "cancelled") return false;
      const s = new Date(item.startTime).getTime();
      const e = new Date(item.endTime).getTime();
      return start < e && end > s;
    });
  }

  function resetCreateForm() {
    setBlockForm({
      title: "",
      date: "",
      startTime: "09:00",
      endTime: "10:00",
      notes: "",
      location: "",
      color: "#0ea5e9",
      useGoogleMeet: true,
      participants: [{ email: "", name: "" }],
    });
    setCreateKind("block");
    setBlockError(null);
  }

  async function submitCreate({ ignoreConflicts = false } = {}) {
    const startTime = new Date(`${blockForm.date}T${blockForm.startTime}:00`).toISOString();
    const endTime = new Date(`${blockForm.date}T${blockForm.endTime}:00`).toISOString();

    if (createKind === "block") {
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
      return { res, data: await res.json() };
    }

    const participants = (blockForm.participants || [])
      .map((p) => ({
        email: (p.email || "").trim(),
        name: (p.name || "").trim() || undefined,
      }))
      .filter((p) => p.email);

    if (participants.length === 0) {
      return {
        res: { ok: false, status: 400 },
        data: { error: "Add at least one participant email" },
      };
    }

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: blockForm.title || "Meeting",
        description: blockForm.notes || undefined,
        startTime,
        endTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: blockForm.useGoogleMeet ? "Google Meet" : blockForm.location || undefined,
        color: blockForm.color || undefined,
        participants,
        createGoogleMeet: Boolean(blockForm.useGoogleMeet),
        ignoreConflicts,
      }),
    });
    return { res, data: await res.json() };
  }

  async function handleCreateBlock(e) {
    e.preventDefault();
    setBlockError(null);

    if (!blockForm.date || !blockForm.startTime || !blockForm.endTime) {
      setBlockError("Date, start time, and end time are required");
      return;
    }

    const startTime = new Date(`${blockForm.date}T${blockForm.startTime}:00`);
    const endTime = new Date(`${blockForm.date}T${blockForm.endTime}:00`);
    if (!(endTime > startTime)) {
      setBlockError("End time must be after start time");
      return;
    }

    if (createKind === "meeting") {
      const hasEmail = (blockForm.participants || []).some((p) => (p.email || "").trim());
      if (!hasEmail) {
        setBlockError("Add at least one participant email for a meeting");
        return;
      }
    }

    // 本地日曆已有重疊 → 先請使用者確認
    const localConflicts = findLocalConflicts(startTime.toISOString(), endTime.toISOString());
    if (localConflicts.length > 0) {
      const names = localConflicts
        .slice(0, 3)
        .map((c) => c.title || "Busy")
        .join(", ");
      setConfirmState({
        title: "This time overlaps existing items",
        description: `Conflicts with: ${names}${localConflicts.length > 3 ? "…" : ""}. Create anyway?`,
        confirmLabel: "Create anyway",
        danger: false,
        onConfirm: () => doCreate({ ignoreConflicts: true }),
      });
      return;
    }

    await doCreate({ ignoreConflicts: false });
  }

  async function doCreate({ ignoreConflicts = false } = {}) {
    setIsSavingBlock(true);
    setBlockError(null);
    try {
      const { res, data } = await submitCreate({ ignoreConflicts });

      // Google Calendar 衝突（僅會議）
      if (res.status === 409 && !ignoreConflicts) {
        setConfirmState({
          title: "Google Calendar has something here",
          description:
            data.message ||
            "This time overlaps an event on your Google Calendar. Create anyway?",
          confirmLabel: "Create anyway",
          danger: false,
          onConfirm: () => doCreate({ ignoreConflicts: true }),
        });
        return;
      }

      if (!res.ok) {
        setBlockError(data.error || "Failed to save");
        return;
      }

      setShowBlockForm(false);
      resetCreateForm();
      toast.success(
        createKind === "meeting"
          ? `Meeting created${data.emailsSent ? ` — ${data.emailsSent} invited` : ""}`
          : "Added to your calendar"
      );
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

  function openEdit(item) {
    if (!item || item.source === "google") return;
    if (item.source === "booking" && item.status === "pending") {
      toast.error("Approve the booking before changing its time");
      return;
    }
    setEditError(null);
    setEditingItem(item);
    const hasMeet = Boolean(item.meetingUrl) || /google meet/i.test(item.location || "");
    setEditForm({
      title: item.title || "",
      date: toLocalDateInput(item.startTime),
      startTime: toLocalTimeInput(item.startTime),
      endTime: toLocalTimeInput(item.endTime),
      notes: item.notes || item.description || item.inviteeNotes || "",
      location: item.location || "",
      color: item.color || "#0ea5e9",
      useGoogleMeet: hasMeet,
      participants:
        item.participants?.length > 0
          ? item.participants.map((p) => ({
              email: p.email || "",
              name: p.name || "",
            }))
          : [{ email: "", name: "" }],
    });
    setSelectedItem(null);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingItem) return;
    setEditError(null);

    if (!editForm.date || !editForm.startTime || !editForm.endTime) {
      setEditError("Date, start, and end are required");
      return;
    }

    const startTime = new Date(`${editForm.date}T${editForm.startTime}:00`).toISOString();
    const endTime = new Date(`${editForm.date}T${editForm.endTime}:00`).toISOString();
    if (new Date(endTime) <= new Date(startTime)) {
      setEditError("End time must be after start time");
      return;
    }

    setIsSavingEdit(true);
    try {
      let res;
      if (editingItem.source === "block") {
        res = await fetch(`/api/blocks/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editForm.title || "Busy",
            notes: editForm.notes || undefined,
            startTime,
            endTime,
            color: editForm.color,
          }),
        });
      } else if (editingItem.source === "event") {
        const participants = (editForm.participants || [])
          .map((p) => ({
            email: (p.email || "").trim(),
            name: (p.name || "").trim() || undefined,
          }))
          .filter((p) => p.email);
        if (participants.length === 0) {
          setEditError("Add at least one participant email");
          setIsSavingEdit(false);
          return;
        }
        res = await fetch(`/api/events/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editForm.title || "Meeting",
            description: editForm.notes || undefined,
            location: editForm.useGoogleMeet
              ? "Google Meet"
              : editForm.location || undefined,
            color: editForm.color,
            startTime,
            endTime,
            participants,
            createGoogleMeet: Boolean(editForm.useGoogleMeet && !editingItem.meetingUrl),
          }),
        });
      } else if (editingItem.source === "booking") {
        // 預約改期：時間；標題由 event type 決定不能改
        res = await fetch(`/api/bookings/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startTime, endTime }),
        });
      } else {
        setEditError("This item cannot be edited here");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Failed to save changes");
        return;
      }

      setEditingItem(null);
      if (editingItem.source === "booking") {
        toast.success("Booking rescheduled");
      } else if (editingItem.source === "event") {
        const parts = [];
        if (data.addedCount) parts.push(`${data.addedCount} invited`);
        if (data.removedCount) parts.push(`${data.removedCount} removed (notified)`);
        if (data.emailsSent && !parts.length) parts.push(`${data.emailsSent} notified`);
        toast.success(parts.length ? `Saved — ${parts.join(", ")}` : "Saved");
      } else {
        toast.success("Saved");
      }
      await loadSchedule();
    } catch (err) {
      setEditError("Something went wrong. Please try again.");
    } finally {
      setIsSavingEdit(false);
    }
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

  const dayViewDate = useMemo(() => addDays(startOfDay(new Date()), dayOffset), [dayOffset]);
  const weekStart = useMemo(
    () => addDays(startOfWeek(new Date()), weekOffset * 7),
    [weekOffset]
  );
  const monthDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
  }, [monthOffset]);
  const yearDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear() + yearOffset, 0, 1);
  }, [yearOffset]);

  // day/week 共用同一份時間格線,只是天數不同(1 天 vs 7 天)
  const days = useMemo(() => {
    if (view === "day") return [dayViewDate];
    return [...Array(7)].map((_, i) => addDays(weekStart, i));
  }, [view, dayViewDate, weekStart]);

  function goToPrev() {
    if (view === "day") setDayOffset((o) => o - 1);
    else if (view === "week") setWeekOffset((o) => o - 1);
    else if (view === "month") setMonthOffset((o) => o - 1);
    else setYearOffset((o) => o - 1);
  }

  function goToNext() {
    if (view === "day") setDayOffset((o) => o + 1);
    else if (view === "week") setWeekOffset((o) => o + 1);
    else if (view === "month") setMonthOffset((o) => o + 1);
    else setYearOffset((o) => o + 1);
  }

  function goToToday() {
    if (view === "day") setDayOffset(0);
    else if (view === "week") setWeekOffset(0);
    else if (view === "month") setMonthOffset(0);
    else setYearOffset(0);
  }

  // 從月曆/年曆點某一天或某個月,跳去對應的天/月檢視,並記住那個位置
  function jumpToDay(day) {
    const diffDays = Math.round((startOfDay(day) - startOfDay(new Date())) / 86400000);
    setDayOffset(diffDays);
    setView("day");
  }

  function jumpToMonth(m) {
    const base = new Date();
    const diffMonths = (m.getFullYear() - base.getFullYear()) * 12 + (m.getMonth() - base.getMonth());
    setMonthOffset(diffMonths);
    setView("month");
  }

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goToPrev} className="btn btn-ghost btn-sm">
            ← Prev
          </button>
          <button type="button" onClick={goToToday} className="btn btn-ghost btn-sm">
            Today
          </button>
          <button type="button" onClick={goToNext} className="btn btn-ghost btn-sm">
            Next →
          </button>

          {/* Day / Week / Month / Year 切換 */}
          <div className="join ml-2">
            {["day", "week", "month", "year"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`join-item btn btn-sm capitalize ${
                  view === v ? "btn-primary" : "btn-ghost"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-base-content/80">
            {view === "day"
              ? dayViewDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : view === "week"
                ? weekStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : view === "month"
                  ? monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                  : yearDate.getFullYear()}
          </span>
          {(view === "day" || view === "week") && (
            <span className="hidden md:inline text-[11px] text-base-content/40">
              Tip: drag on the grid to add time — or use + Add for meeting / busy
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowBlockForm(true)}
            className="btn btn-primary btn-sm"
          >
            + Add
          </button>
        </div>
      </div>

      {view === "month" ? (
        <div className="rounded-2xl border border-base-300 bg-base-200 overflow-hidden animate-opacity">
          <div className="grid grid-cols-7 border-b border-base-300">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-2 py-2 text-center text-xs font-medium text-base-content/50"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGridDays(monthDate).map((day) => {
              const inMonth = day.getMonth() === monthDate.getMonth();
              const dayItems = itemsForDay(day);
              const isToday = isSameDay(day, now);
              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  onClick={() => jumpToDay(day)}
                  className={`min-h-[92px] border-r border-b border-base-300 p-1.5 text-left flex flex-col gap-1 transition-colors hover:bg-base-300/40 ${
                    inMonth ? "" : "opacity-40"
                  } ${isToday ? "bg-primary/10" : ""}`}
                >
                  <span className={`text-xs font-semibold ${isToday ? "text-primary" : ""}`}>
                    {day.getDate()}
                  </span>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayItems.slice(0, 3).map((item) => (
                      <p
                        key={item.id}
                        className="truncate text-[10px] rounded px-1 py-0.5"
                        style={{
                          backgroundColor: hexToRgba(item.color, 0.15),
                          color: item.color,
                        }}
                      >
                        {item.title}
                      </p>
                    ))}
                    {dayItems.length > 3 && (
                      <p className="text-[10px] text-base-content/40">
                        +{dayItems.length - 3} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : view === "year" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-opacity">
          {[...Array(12)].map((_, m) => {
            const monthForCell = new Date(yearDate.getFullYear(), m, 1);
            const monthItemCount = items.filter((item) => {
              const d = new Date(item.startTime);
              return (
                d.getFullYear() === monthForCell.getFullYear() &&
                d.getMonth() === monthForCell.getMonth()
              );
            }).length;

            return (
              <button
                type="button"
                key={m}
                onClick={() => jumpToMonth(monthForCell)}
                className="rounded-xl border border-base-300 bg-base-200 p-3 text-left hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold">
                    {monthForCell.toLocaleDateString("en-US", { month: "long" })}
                  </p>
                  {monthItemCount > 0 && (
                    <span className="text-[10px] text-base-content/40">{monthItemCount}</span>
                  )}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {monthGridDays(monthForCell).map((day) => {
                    const inMonth = day.getMonth() === monthForCell.getMonth();
                    const hasItems = inMonth && itemsForDay(day).length > 0;
                    const isToday = isSameDay(day, now);
                    return (
                      <span
                        key={day.toISOString()}
                        className={`text-[8px] w-4 h-4 flex items-center justify-center rounded-full ${
                          !inMonth
                            ? "text-base-content/20"
                            : isToday
                              ? "bg-primary text-primary-content font-bold"
                              : hasItems
                                ? "bg-primary/20 font-medium"
                                : "text-base-content/60"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
      <div
        key={days[0]?.toISOString()}
        className="rounded-2xl border border-base-300 bg-base-200 overflow-x-auto animate-opacity"
      >
        <div className={days.length === 1 ? "min-w-[320px]" : "min-w-[720px]"}>
          {/* 日期標頭 */}
          <div
            className={`grid border-b border-base-300 ${
              days.length === 1 ? "grid-cols-[56px_1fr]" : "grid-cols-[56px_repeat(7,1fr)]"
            }`}
          >
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
          <div
            className={`grid ${
              days.length === 1 ? "grid-cols-[56px_1fr]" : "grid-cols-[56px_repeat(7,1fr)]"
            }`}
          >
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

                  {/* 可預約時段：扣掉日曆上已有行程後才顯示，與實際可約同步 */}
                  {freeSegmentsForDay(day, dayRules, dayItems, hourStart, hourEnd).map((seg, i) => (
                    <div
                      key={i}
                      className="absolute left-0.5 right-0.5 rounded-sm border border-dashed group pointer-events-none"
                      style={{
                        top: `${Math.max(0, (seg.startHour - hourStart) * HOUR_HEIGHT)}px`,
                        height: `${Math.max(4, (seg.endHour - seg.startHour) * HOUR_HEIGHT)}px`,
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
      )}

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

            {selectedItem.meetingUrl && (
              <a
                href={selectedItem.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-primary w-full"
              >
                Join Google Meet
              </a>
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

            {selectedItem.source === "google" ? (
              <p className="text-xs text-base-content/40 text-center">
                Synced from Google Calendar — manage it there.
              </p>
            ) : selectedItem.source === "block" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(selectedItem)}
                  className="btn btn-primary btn-sm flex-1"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteBlock(selectedItem)}
                  disabled={isCancelling}
                  className="btn btn-outline btn-error btn-sm flex-1"
                >
                  {isCancelling ? "Removing…" : "Remove"}
                </button>
              </div>
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(selectedItem)}
                  className="btn btn-primary btn-sm flex-1"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleCancel(selectedItem)}
                  disabled={isCancelling}
                  className="btn btn-outline btn-error btn-sm flex-1"
                >
                  {isCancelling ? "Cancelling…" : "Cancel"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}


      {editingItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-opacity"
          onClick={() => setEditingItem(null)}
        >
          <form
            onSubmit={handleSaveEdit}
            className="bg-base-100 border border-base-300 rounded-2xl max-w-md w-full p-6 space-y-4 animate-popup max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg">Edit</h2>
                <p className="text-xs text-base-content/50 mt-0.5">
                  {editingItem.source === "booking"
                    ? "Reschedule this booking (guest will be notified)"
                    : editingItem.source === "event"
                      ? "Update meeting — participants are notified if details change"
                      : "Update your personal block"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-base-content/40 hover:text-base-content"
              >
                ✕
              </button>
            </div>

            {editingItem.source !== "booking" && (
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="input input-bordered input-sm w-full"
                />
              </div>
            )}

            {editingItem.source === "booking" && (
              <p className="text-sm font-medium">{editingItem.title}</p>
            )}

            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-1">Date</label>
              <input
                type="date"
                required
                value={editForm.date}
                onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                className="input input-bordered input-sm w-full"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-base-content/80 mb-1">Start</label>
                <input
                  type="time"
                  required
                  value={editForm.startTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="input input-bordered input-sm w-full"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-base-content/80 mb-1">End</label>
                <input
                  type="time"
                  required
                  value={editForm.endTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="input input-bordered input-sm w-full"
                />
              </div>
            </div>

            {editingItem.source === "event" && (
              <>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm mt-0.5"
                    checked={Boolean(editForm.useGoogleMeet)}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, useGoogleMeet: e.target.checked }))
                    }
                  />
                  <span>
                    Online — Google Meet
                    <span className="block text-xs text-base-content/45 mt-0.5 font-normal">
                      {editingItem.meetingUrl
                        ? "Already has a Meet link; keep checked to keep it as online."
                        : "Check to create a Meet link and include it in emails."}
                    </span>
                  </span>
                </label>

                {!editForm.useGoogleMeet && (
                  <div>
                    <label className="block text-sm font-medium text-base-content/80 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                      className="input input-bordered input-sm w-full"
                      placeholder="Office or custom link"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-base-content/80">Participants</label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() =>
                        setEditForm((f) => ({
                          ...f,
                          participants: [...(f.participants || []), { email: "", name: "" }],
                        }))
                      }
                    >
                      + Add
                    </button>
                  </div>
                  {(editForm.participants || []).map((person, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <input
                        type="email"
                        required={index === 0}
                        value={person.email}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            participants: f.participants.map((row, i) =>
                              i === index ? { ...row, email: e.target.value } : row
                            ),
                          }))
                        }
                        className="input input-bordered input-sm flex-1"
                        placeholder="email@example.com"
                      />
                      <input
                        type="text"
                        value={person.name || ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            participants: f.participants.map((row, i) =>
                              i === index ? { ...row, name: e.target.value } : row
                            ),
                          }))
                        }
                        className="input input-bordered input-sm w-24"
                        placeholder="Name"
                      />
                      {(editForm.participants || []).length > 1 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() =>
                            setEditForm((f) => ({
                              ...f,
                              participants: f.participants.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="text-[11px] text-base-content/45">
                    New people get an invite email; removed people get a cancellation email.
                  </p>
                </div>
              </>
            )}

            {editingItem.source !== "booking" && (
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-1">
                  {editingItem.source === "event" ? "Description" : "Notes"} (optional)
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="textarea textarea-bordered textarea-sm w-full"
                />
              </div>
            )}

            {(editingItem.source === "event" || editingItem.source === "block") && (
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {MEETING_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, color: c }))}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full ${
                        editForm.color === c
                          ? "ring-2 ring-offset-2 ring-offset-base-100 ring-base-content scale-110"
                          : ""
                      }`}
                    />
                  ))}
                  <label className="flex items-center" title="Custom color">
                    <input
                      type="color"
                      value={editForm.color || "#0ea5e9"}
                      onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                      className="w-7 h-7 rounded-full border-0 p-0 cursor-pointer bg-transparent"
                    />
                  </label>
                </div>
              </div>
            )}

            {editError && <p className="text-sm text-error">{editError}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="btn btn-ghost btn-sm flex-1"
              >
                Cancel
              </button>
              <button type="submit" disabled={isSavingEdit} className="btn btn-primary btn-sm flex-1">
                {isSavingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showBlockForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-opacity"
          onClick={() => {
            setShowBlockForm(false);
            resetCreateForm();
          }}
        >
          <form
            onSubmit={handleCreateBlock}
            className="bg-base-100 border border-base-300 rounded-2xl max-w-md w-full p-6 space-y-4 animate-popup max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="font-bold text-lg">Add to calendar</h2>
              <button
                type="button"
                onClick={() => {
                  setShowBlockForm(false);
                  resetCreateForm();
                }}
                className="text-base-content/40 hover:text-base-content"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCreateKind("block")}
                className={`btn btn-sm flex-1 ${createKind === "block" ? "btn-primary" : "btn-outline"}`}
              >
                Personal / Busy
              </button>
              <button
                type="button"
                onClick={() => setCreateKind("meeting")}
                className={`btn btn-sm flex-1 ${createKind === "meeting" ? "btn-primary" : "btn-outline"}`}
              >
                Meeting
              </button>
            </div>
            <p className="text-xs text-base-content/50 -mt-1">
              {createKind === "block"
                ? "Blocks the time on your booking page. No one is invited."
                : "Creates a meeting, emails participants, and can sync to Google Calendar."}
            </p>

            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-1">Title</label>
              <input
                type="text"
                value={blockForm.title}
                onChange={(e) => setBlockForm((f) => ({ ...f, title: e.target.value }))}
                className="input input-bordered input-sm w-full"
                placeholder={createKind === "meeting" ? "Team sync" : "Busy"}
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

            {createKind === "meeting" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-base-content/80 mb-2">Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {MEETING_COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBlockForm((f) => ({ ...f, color: c }))}
                        style={{ backgroundColor: c }}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          blockForm.color === c
                            ? "ring-2 ring-offset-2 ring-offset-base-100 ring-base-content scale-110"
                            : ""
                        }`}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                    <label className="flex items-center" title="Custom color">
                      <input
                        type="color"
                        value={blockForm.color || "#0ea5e9"}
                        onChange={(e) => setBlockForm((f) => ({ ...f, color: e.target.value }))}
                        className="w-7 h-7 rounded-full border-0 p-0 cursor-pointer bg-transparent"
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-base-content/80">Participants</label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() =>
                        setBlockForm((f) => ({
                          ...f,
                          participants: [...(f.participants || []), { email: "", name: "" }],
                        }))
                      }
                    >
                      + Add
                    </button>
                  </div>
                  {(blockForm.participants || []).map((p, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <input
                        type="email"
                        required={index === 0}
                        value={p.email}
                        onChange={(e) =>
                          setBlockForm((f) => ({
                            ...f,
                            participants: f.participants.map((row, i) =>
                              i === index ? { ...row, email: e.target.value } : row
                            ),
                          }))
                        }
                        className="input input-bordered input-sm flex-1"
                        placeholder="email@example.com"
                      />
                      <input
                        type="text"
                        value={p.name || ""}
                        onChange={(e) =>
                          setBlockForm((f) => ({
                            ...f,
                            participants: f.participants.map((row, i) =>
                              i === index ? { ...row, name: e.target.value } : row
                            ),
                          }))
                        }
                        className="input input-bordered input-sm w-28"
                        placeholder="Name"
                      />
                      {(blockForm.participants || []).length > 1 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() =>
                            setBlockForm((f) => ({
                              ...f,
                              participants: f.participants.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm mt-0.5"
                    checked={Boolean(blockForm.useGoogleMeet)}
                    onChange={(e) =>
                      setBlockForm((f) => ({ ...f, useGoogleMeet: e.target.checked }))
                    }
                  />
                  <span>
                    Online — create Google Meet link (sent in invite email)
                    <span className="block text-xs text-base-content/45 mt-0.5 font-normal">
                      The link stays with this calendar event; it does not expire after a few hours.
                      If you delete the event, the Meet room is removed too.
                    </span>
                  </span>
                </label>

                {!blockForm.useGoogleMeet && (
                  <div>
                    <label className="block text-sm font-medium text-base-content/80 mb-1">
                      Location (optional)
                    </label>
                    <input
                      type="text"
                      value={blockForm.location}
                      onChange={(e) => setBlockForm((f) => ({ ...f, location: e.target.value }))}
                      className="input input-bordered input-sm w-full"
                      placeholder="Office address or Zoom link"
                    />
                  </div>
                )}
              </>
            )}

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
              {isSavingBlock
                ? "Saving…"
                : createKind === "meeting"
                  ? "Create meeting"
                  : "Block time"}
            </button>
          </form>
        </div>
      )}

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
