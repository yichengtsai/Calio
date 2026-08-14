import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import EventType from "@/models/EventType";
import Availability from "@/models/Availability";
import Booking from "@/models/Booking";
import Event from "@/models/Event";
import Block from "@/models/Block";
import { getSlotsForDate } from "@/libs/slots";
import { rateLimit, getClientIp } from "@/libs/rateLimit";
import { checkCalendarConflict } from "@/libs/googleCalendar";
import { canUseGoogleCalendarSync } from "@/libs/plans";
import { addDaysToDateStr } from "@/libs/timezone";

export async function GET(req) {
  const ip = getClientIp(req);
  const limit = rateLimit(`availability-month:ip:${ip}`, 30, 5 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  const slug = searchParams.get("slug");
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  if (!username || !slug || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Missing username, slug, start, or end" },
      { status: 400 }
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
  ) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  if (startDate > endDate) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  await connectMongo();

  const user = await User.findOne({ username }).lean();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const eventType = await EventType.findOne({
    user: user._id,
    slug,
    isActive: true,
  }).lean();
  if (!eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  const availability = await Availability.findOne({ user: user._id }).lean();
  const timeSlots = availability?.timeSlots || [];

  const startAnchor = new Date(`${startDate}T00:00:00Z`);
  const endAnchor = new Date(`${endDate}T00:00:00Z`);
  const rangeStart = new Date(startAnchor.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(endAnchor.getTime() + 2 * 24 * 60 * 60 * 1000);

  const duration = Number(eventType.duration) || 30;
  const bufferMinutes = Number(eventType.bufferMinutes) || 0;
  const minimumNoticeMinutes = Number(eventType.minimumNoticeMinutes) || 0;
  const bookingWindowDays = eventType.bookingWindowDays ?? 60;
  const maxBookingsPerDay = Number(eventType.maxBookingsPerDay) || 0;
  const slotIntervalMinutes = Number(eventType.slotIntervalMinutes) || 0;
  const timezone = user.timezone || "Asia/Taipei";

  const [existingBookings, busyEvents, busyBlocks] = await Promise.all([
    Booking.find({
      organizer: user._id,
      status: { $in: ["pending", "confirmed"] },
      startTime: { $lt: rangeEnd },
      endTime: { $gt: rangeStart },
    })
      .select("startTime endTime")
      .lean(),
    Event.find({
      organizer: user._id,
      status: { $ne: "cancelled" },
      startTime: { $lt: rangeEnd },
      endTime: { $gt: rangeStart },
    })
      .select("startTime endTime")
      .lean(),
    Block.find({
      user: user._id,
      startTime: { $lt: rangeEnd },
      endTime: { $gt: rangeStart },
    })
      .select("startTime endTime")
      .lean(),
  ]);

  let googleBusy = [];
  if (canUseGoogleCalendarSync(user)) {
    const { checked, conflicts } = await checkCalendarConflict(
      user._id,
      rangeStart,
      rangeEnd
    );
    if (checked) {
      googleBusy = conflicts
        .filter((b) => b.start && b.end)
        .map((b) => ({ startTime: new Date(b.start), endTime: new Date(b.end) }));
    }
  }

  const busy = [...existingBookings, ...busyEvents, ...busyBlocks, ...googleBusy];

  const slotsByDate = {};
  const firstDate = addDaysToDateStr(startDate, -1);
  const lastDate = addDaysToDateStr(endDate, 1);
  let cursor = firstDate;
  while (cursor <= lastDate) {
    const confirmedCountOnDate = existingBookings.filter((b) => {
      try {
        return new Date(b.startTime).toISOString().slice(0, 10) === cursor;
      } catch {
        return false;
      }
    }).length;

    const slots = getSlotsForDate({
      timeSlots,
      timezone,
      duration,
      dateStr: cursor,
      existingBookings: busy,
      bufferMinutes,
      minimumNoticeMinutes,
      bookingWindowDays,
      maxBookingsPerDay,
      confirmedCountOnDate,
      slotIntervalMinutes,
    });
    slotsByDate[cursor] = slots.map((s) => s.start.toISOString());
    cursor = addDaysToDateStr(cursor, 1);
  }

  return NextResponse.json({
    slotsByDate,
    timezone,
    durationMinutes: duration,
    bufferMinutes,
    slotIntervalMinutes,
  });
}
