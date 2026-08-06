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
  const limit = rateLimit(`availability:ip:${ip}`, 60, 5 * 60 * 1000); // 5分鐘60次,一般點選日期不太可能超過
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  const slug = searchParams.get("slug");
  const date = searchParams.get("date"); // "YYYY-MM-DD"

  if (!username || !slug || !date) {
    return NextResponse.json(
      { error: "Missing username, slug, or date" },
      { status: 400 }
    );
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

  // 寬鬆抓「查詢日期」前後各一天範圍的既有預約,避免時區邊界導致漏抓
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
    // 你自己建的行程(不管有沒有邀請別人)也要擋掉公開頁的空檔,不然別人可能約到你已經有事的時段
    Event.find({
      organizer: user._id,
      status: { $ne: "cancelled" },
      startTime: { $lt: rangeEnd },
      endTime: { $gt: rangeStart },
    }).select("startTime endTime"),
    // 你自己填的忙碌時段,一樣要擋掉
    Block.find({
      user: user._id,
      startTime: { $lt: rangeEnd },
      endTime: { $gt: rangeStart },
    }).select("startTime endTime"),
  ]);

  // Pro 版:即時查一次 Google Calendar 這段範圍內的忙碌時段,一併擋掉。
  // 這樣如果主辦人在 Google Calendar 上直接加了一個跟 Calio 無關的行程(例如手動加的內部會議),
  // 公開頁也會馬上反映出「這時段不能約」,不用等他自己回來手動填 Block。
  let googleBusy = [];
  if (canUseGoogleCalendarSync(user)) {
    const { checked, conflicts } = await checkCalendarConflict(user._id, rangeStart, rangeEnd);
    if (checked) {
      googleBusy = conflicts
        .filter((b) => b.start && b.end)
        .map((b) => ({ startTime: new Date(b.start), endTime: new Date(b.end) }));
    }
  }

  const slots = getSlotsForDate({
    timeSlots,
    timezone: user.timezone || "Asia/Taipei",
    duration: eventType.duration,
    dateStr: date,
    existingBookings: [...existingBookings, ...busyEvents, ...busyBlocks, ...googleBusy],
    bufferMinutes: eventType.bufferMinutes || 0,
    minimumNoticeMinutes: eventType.minimumNoticeMinutes || 0,
  });

  return NextResponse.json({
    slots: slots.map((s) => s.start.toISOString()),
    timezone: user.timezone || "Asia/Taipei",
  });
}
