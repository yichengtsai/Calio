import { zonedTimeToUtc, dayOfWeekForDateStr } from "@/libs/timezone";

function normalizeBusyIntervals(list = []) {
  const out = [];
  for (const b of list) {
    if (!b) continue;
    const rawStart = b.startTime ?? b.start;
    const rawEnd = b.endTime ?? b.end;
    if (rawStart == null || rawEnd == null) continue;
    const start = rawStart instanceof Date ? new Date(rawStart.getTime()) : new Date(rawStart);
    const end = rawEnd instanceof Date ? new Date(rawEnd.getTime()) : new Date(rawEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (end <= start) {
      out.push({ start, end: new Date(start.getTime() + 60 * 1000) });
    } else {
      out.push({ start, end });
    }
  }
  return out;
}

function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start.getTime() <= last.end.getTime()) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      merged.push({ start: cur.start, end: cur.end });
    }
  }
  return merged;
}

/** availability 減 busy → 空檔 */
function subtractBusy(availability, busyList) {
  let free = availability.map((a) => ({
    start: new Date(a.start.getTime()),
    end: new Date(a.end.getTime()),
  }));

  for (const b of busyList) {
    const next = [];
    for (const f of free) {
      if (b.end.getTime() <= f.start.getTime() || b.start.getTime() >= f.end.getTime()) {
        next.push(f);
        continue;
      }
      // 左切
      if (b.start.getTime() <= f.start.getTime() && b.end.getTime() < f.end.getTime()) {
        next.push({ start: new Date(b.end.getTime()), end: f.end });
        continue;
      }
      // 右切
      if (b.start.getTime() > f.start.getTime() && b.end.getTime() >= f.end.getTime()) {
        next.push({ start: f.start, end: new Date(b.start.getTime()) });
        continue;
      }
      // 中間切開
      if (b.start.getTime() > f.start.getTime() && b.end.getTime() < f.end.getTime()) {
        next.push({ start: f.start, end: new Date(b.start.getTime()) });
        next.push({ start: new Date(b.end.getTime()), end: f.end });
        continue;
      }
      // 完全覆蓋 → 不保留
    }
    free = next;
  }

  return free.filter((f) => f.end.getTime() > f.start.getTime());
}

function getHourMinuteInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return { hour, minute: Number(map.minute) };
}

function timeOnDate(dateStr, hour, minute, timeZone) {
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return zonedTimeToUtc(dateStr, timeStr, timeZone);
}

/**
 * 在空檔內產生候選開始時間：
 * 1. 一定包含 gap.start（緩衝後最早能開始的那一刻）← 修掉「對齊後跳過 10:15」的 bug
 * 2. 再加上每 stepMin 的時鐘刻度（10:00、10:15、10:30…）
 */
function candidateStartsInGap(gap, dateStr, timeZone, stepMin, durationMs) {
  const lastStartMs = gap.end.getTime() - durationMs;
  if (lastStartMs < gap.start.getTime()) return [];

  const starts = [];
  const seen = new Set();
  const add = (d) => {
    if (!d || Number.isNaN(d.getTime())) return;
    const t = d.getTime();
    if (t < gap.start.getTime() || t > lastStartMs) return;
    if (t + durationMs > gap.end.getTime()) return;
    const key = d.toISOString();
    if (seen.has(key)) return;
    seen.add(key);
    starts.push(new Date(t));
  };

  // (1) 空檔起點 — 例如緩衝後的 10:15
  add(gap.start);

  // (2) 時鐘對齊的間隔刻度
  const { hour, minute } = getHourMinuteInZone(gap.start, timeZone);
  const totalMins = hour * 60 + minute;
  let aligned = Math.ceil(totalMins / stepMin) * stepMin;
  // 若 ceil 還是同一個點，下一圈從下一格開始；gap.start 已加過
  if (aligned === totalMins) aligned += stepMin;

  for (let mins = aligned; mins < 24 * 60; mins += stepMin) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const d = timeOnDate(dateStr, h, m, timeZone);
    if (d.getTime() > lastStartMs) break;
    add(d);
  }

  starts.sort((a, b) => a.getTime() - b.getTime());
  return starts;
}

/**
 * 可預約時段
 *
 * 例：前一段 10:00 結束、下一段 11:15 開始，buffer=15、duration=45
 *   → 忙碌擴大到 10:15 與 11:00
 *   → 空檔 10:15–11:00（45 分）
 *   → 一定放出 10:15（空檔起點），不會因「間隔對齊」被吃掉
 */
export function getSlotsForDate({
  timeSlots,
  timezone,
  duration,
  dateStr,
  existingBookings = [],
  now = new Date(),
  bufferMinutes = 0,
  minimumNoticeMinutes = 0,
  bookingWindowDays = 0,
  maxBookingsPerDay = 0,
  confirmedCountOnDate = 0,
  slotIntervalMinutes = 0,
}) {
  const durationMin = Math.max(5, Number(duration) || 30);
  const bufferMin = Math.max(0, Number(bufferMinutes) || 0);
  const noticeMin = Math.max(0, Number(minimumNoticeMinutes) || 0);
  const windowDays = Number(bookingWindowDays) || 0;
  const rawStep = Number(slotIntervalMinutes);
  const stepMin = Math.max(5, rawStep > 0 ? rawStep : durationMin);

  if (windowDays > 0) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = formatter.format(now);
    const todayUtc = new Date(`${todayStr}T00:00:00Z`);
    const targetUtc = new Date(`${dateStr}T00:00:00Z`);
    const diffDays = Math.round((targetUtc - todayUtc) / (24 * 60 * 60 * 1000));
    if (diffDays < 0 || diffDays > windowDays) {
      return [];
    }
  }

  if (maxBookingsPerDay > 0 && confirmedCountOnDate >= maxBookingsPerDay) {
    return [];
  }

  const dayOfWeek = dayOfWeekForDateStr(dateStr);
  const rulesForDay = (timeSlots || []).filter((s) => s.dayOfWeek === dayOfWeek);
  if (rulesForDay.length === 0) return [];

  const durationMs = durationMin * 60 * 1000;
  const bufferMs = bufferMin * 60 * 1000;
  const earliestBookable = new Date(now.getTime() + noticeMin * 60 * 1000);

  const availability = [];
  for (const rule of rulesForDay) {
    const start = zonedTimeToUtc(dateStr, rule.startTime, timezone);
    const end = zonedTimeToUtc(dateStr, rule.endTime, timezone);
    if (end > start) availability.push({ start, end });
  }
  if (availability.length === 0) return [];

  // 忙碌前後加 buffer（務必用 getTime，避免 Date 字串相加）
  const busy = mergeIntervals(
    normalizeBusyIntervals(existingBookings).map((b) => ({
      start: new Date(b.start.getTime() - bufferMs),
      end: new Date(b.end.getTime() + bufferMs),
    }))
  );

  const freeGaps = subtractBusy(availability, busy);

  const slots = [];
  const seenStart = new Set();

  for (const gap of freeGaps) {
    if (gap.end.getTime() - gap.start.getTime() < durationMs) continue;

    const candidates = candidateStartsInGap(
      gap,
      dateStr,
      timezone,
      stepMin,
      durationMs
    );

    for (const slotStart of candidates) {
      if (slotStart.getTime() <= earliestBookable.getTime()) continue;
      const slotEnd = new Date(slotStart.getTime() + durationMs);
      const key = slotStart.toISOString();
      if (seenStart.has(key)) continue;
      seenStart.add(key);
      slots.push({ start: slotStart, end: slotEnd });
    }
  }

  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return slots;
}
