import { zonedTimeToUtc, dayOfWeekForDateStr } from "@/libs/timezone";

/**
 * 算出某一天(dateStr, 例如 "2026-08-03",以 organizer 的時區為準)有哪些可預約時段。
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
}) {
  if (bookingWindowDays > 0) {
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
    if (diffDays < 0 || diffDays > bookingWindowDays) {
      return [];
    }
  }

  if (maxBookingsPerDay > 0 && confirmedCountOnDate >= maxBookingsPerDay) {
    return [];
  }

  const dayOfWeek = dayOfWeekForDateStr(dateStr);
  const rulesForDay = timeSlots.filter((s) => s.dayOfWeek === dayOfWeek);

  const slots = [];
  const durationMs = duration * 60 * 1000;
  const bufferMs = bufferMinutes * 60 * 1000;
  const earliestBookable = new Date(now.getTime() + minimumNoticeMinutes * 60 * 1000);

  for (const rule of rulesForDay) {
    const windowStart = zonedTimeToUtc(dateStr, rule.startTime, timezone);
    const windowEnd = zonedTimeToUtc(dateStr, rule.endTime, timezone);

    let cursor = windowStart;

    while (cursor.getTime() + durationMs <= windowEnd.getTime()) {
      const slotStart = cursor;
      const slotEnd = new Date(cursor.getTime() + durationMs);

      const isTooSoon = slotStart <= earliestBookable;
      const overlapsBooking = existingBookings.some((b) => {
        const bufferedStart = new Date(b.startTime.getTime() - bufferMs);
        const bufferedEnd = new Date(b.endTime.getTime() + bufferMs);
        return slotStart < bufferedEnd && slotEnd > bufferedStart;
      });

      if (!isTooSoon && !overlapsBooking) {
        slots.push({ start: slotStart, end: slotEnd });
      }

      cursor = new Date(cursor.getTime() + durationMs);
    }
  }

  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return slots;
}
