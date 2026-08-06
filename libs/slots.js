import { zonedTimeToUtc, dayOfWeekForDateStr } from "@/libs/timezone";

/**
 * 算出某一天(dateStr, 例如 "2026-08-03",以 organizer 的時區為準)有哪些可預約時段。
 *
 * @param {Object} params
 * @param {Array}  params.timeSlots        Availability.timeSlots,例如 [{ dayOfWeek, startTime, endTime }]
 * @param {string} params.timezone         organizer 的 IANA 時區
 * @param {number} params.duration         這個活動類型的長度(分鐘)
 * @param {string} params.dateStr          要查的日期,格式 "YYYY-MM-DD"
 * @param {Array}  params.existingBookings 這個 organizer 當天已確認的預約,[{ startTime: Date, endTime: Date }]
 * @param {Date}   [params.now]            現在時間,預設 new Date(),測試時可覆寫
 * @returns {Array<{ start: Date, end: Date }>}
 */
export function getSlotsForDate({
  timeSlots,
  timezone,
  duration,
  dateStr,
  existingBookings = [],
  now = new Date(),
  bufferMinutes = 0, // 每個已確認行程前後留的緩衝時間,避免緊接著開下一場
  minimumNoticeMinutes = 0, // 最少要提前多久才能預約,例如至少提前 2 小時 = 120
}) {
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

  // 同一天可能有多條規則產生的時段,依時間排序
  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return slots;
}
