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

export async function GET(req) {
  const ip = getClientIp(req);
  const limit = rateLimit(`availability:ip:${ip}`, 60, 5 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  const slug = searchParams.get("slug");
  const date = searchParams.get("date");

  if (!username || !slug || !date) {
    return NextResponse.json(
      { error: "Missing username, slug, or date" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  await connectMongo();

  const user = await User.findOne({ username });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const eventType = await EventType.findOne({
    user: user._id,
    slug,
    isActive: true,
  });
  if (!eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  const availability = await Availability.findOne({ user: user._id });
  const timeSlots = availability?.timeSlots || [];

  const dayDate = new Date(`${date}T00:00:00Z`);
  const rangeStart = new Date(dayDate.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(dayDate.getTime() + 2 * 24 * 60 * 60 * 1000);

  const [existingBookings, busyEvents, busyBlocks] = await Promise.all([
    Booking.find({
      organizer: user._id,
      status: "confirmed",
      startTime: { $lt: rangeEnd },
      endTime: { $gt: rangeStart },
    }).select("startTime endTime"),
    Event.find({
      organizer: user._id,
      status: { $ne: "cancelled" },
      startTime: { $lt: rangeEnd },
      endTime: { $gt: rangeStart },
    }).select("startTime endTime"),
    Block.find({
      user: user._id,
      startTime: { $lt: rangeEnd },
      endTime: { $gt: rangeStart },
    }).select("startTime endTime"),
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

  const confirmedCountOnDate = existingBookings.filter((b) => {
    return b.startTime.toISOString().slice(0, 10) === date;
  }).length;

  const slots = getSlotsForDate({
    timeSlots,
    timezone: user.timezone || "Asia/Taipei",
    duration: eventType.duration,
    dateStr: date,
    existingBookings: [...existingBookings, ...busyEvents, ...busyBlocks, ...googleBusy],
    bufferMinutes: eventType.bufferMinutes || 0,
    minimumNoticeMinutes: eventType.minimumNoticeMinutes || 0,
    bookingWindowDays: eventType.bookingWindowDays ?? 60,
    maxBookingsPerDay: eventType.maxBookingsPerDay || 0,
    confirmedCountOnDate,
  });

  return NextResponse.json({
    slots: slots.map((s) => s.start.toISOString()),
    timezone: user.timezone || "Asia/Taipei",
  });
}
