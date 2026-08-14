import Booking from "@/models/Booking";
import Event from "@/models/Event";

/**
 * 統一撞期檢查：預約(pending/confirmed) 與 會議(非 cancelled) 彼此都不能重疊。
 * bufferMinutes：把查詢區間前後各擴大（用在「活動類型的緩衝時間」）。
 * excludeBookingId / excludeEventId 用來改期時排除自己。
 */
export async function findInternalConflicts({
  organizerId,
  start,
  end,
  excludeBookingId = null,
  excludeEventId = null,
  bufferMinutes = 0,
}) {
  const bufferMs = Math.max(0, Number(bufferMinutes) || 0) * 60 * 1000;
  // 新時段 [start, end) 需要左右 buffer：等價於既有行程與 [start-B, end+B) 重疊
  const rangeStart = new Date(start.getTime() - bufferMs);
  const rangeEnd = new Date(end.getTime() + bufferMs);

  const bookingQuery = {
    organizer: organizerId,
    status: { $in: ["pending", "confirmed"] },
    startTime: { $lt: rangeEnd },
    endTime: { $gt: rangeStart },
  };
  if (excludeBookingId) {
    bookingQuery._id = { $ne: excludeBookingId };
  }

  const eventQuery = {
    organizer: organizerId,
    status: { $ne: "cancelled" },
    startTime: { $lt: rangeEnd },
    endTime: { $gt: rangeStart },
  };
  if (excludeEventId) {
    eventQuery._id = { $ne: excludeEventId };
  }

  const [booking, event] = await Promise.all([
    Booking.findOne(bookingQuery).select("title startTime endTime status inviteeName").lean(),
    Event.findOne(eventQuery).select("title startTime endTime status").lean(),
  ]);

  const conflicts = [];
  if (booking) {
    conflicts.push({
      type: "booking",
      id: String(booking._id),
      title: booking.inviteeName
        ? `Booking with ${booking.inviteeName}`
        : "Existing booking",
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
    });
  }
  if (event) {
    conflicts.push({
      type: "event",
      id: String(event._id),
      title: event.title || "Existing meeting",
      startTime: event.startTime,
      endTime: event.endTime,
      status: event.status,
    });
  }

  return conflicts;
}

export function conflictErrorMessage(conflicts) {
  if (!conflicts?.length) {
    return "This time overlaps with another booking or meeting (including buffer time).";
  }
  const labels = conflicts.map((c) => c.title || c.type).join(", ");
  return `This time is too close to: ${labels}. Please pick another time (buffer applies).`;
}
