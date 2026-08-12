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

// 給月曆用的「整月一次查完」版本。
//
// 跟 public/availability(單日版)的差別:單日版一次只回答「某一天」的空檔,
// BookingWidget 的月曆過去是每一天各打一次(還要抓前一天/後一天做時區校正),
// 一整個月下來變成 80~90 個請求,如果有接 Google Calendar 同步,
// checkCalendarConflict 這個外部 API 也會被打 80~90 次,是月曆載入慢的主因。
//
// 這支改成:資料庫查詢(Booking/Event/Block)跟 Google Calendar 檢查都只做「一次」,
// 範圍蓋住整個查詢區間,查完之後在記憶體裡逐天套用同一份忙碌時段清單去算空檔,
// 不再對資料庫或 Google Calendar 重複發送請求。
export async function GET(req) {
  const ip = getClientIp(req);
  // 一次月曆只會打這支一次,額度不用留太寬,但切換月份/時區時可能連續觸發幾次,留點餘裕
  const limit = rateLimit(`availability:month:ip:${ip}`, 30, 5 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  const slug = searchParams.get("slug");
  const startDate = searchParams.get("start"); // "YYYY-MM-DD",通常是該月第一天
  const endDate = searchParams.get("end"); // "YYYY-MM-DD",通常是該月最後一天

  if (!username || !slug || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Missing username, slug, start, or end" },
      { status: 400 }
    );
  }

  const startAnchor = new Date(`${startDate}T00:00:00Z`);
  const endAnchor = new Date(`${endDate}T00:00:00Z`);
  const spanDays = (endAnchor.getTime() - startAnchor.getTime()) / (24 * 60 * 60 * 1000);
  // 限制查詢範圍,避免有人帶超大範圍打爆資料庫——一個月最多 31 天,留點餘裕給前後緩衝
  if (Number.isNaN(spanDays) || spanDays < 0 || spanDays > 45) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
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

  // 跟單日版一樣,查詢範圍前後各留一天緩衝,避免時區邊界導致漏抓
  const rangeStart = new Date(startAnchor.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(endAnchor.getTime() + 2 * 24 * 60 * 60 * 1000);

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

  // Google Calendar 一樣改成整個範圍只查一次,而不是每天各查一次
  let googleBusy = [];
  if (canUseGoogleCalendarSync(user)) {
    const { checked, conflicts } = await checkCalendarConflict(user._id, rangeStart, rangeEnd);
    if (checked) {
      googleBusy = conflicts
        .filter((b) => b.start && b.end)
        .map((b) => ({ startTime: new Date(b.start), endTime: new Date(b.end) }));
    }
  }

  const busy = [...existingBookings, ...busyEvents, ...busyBlocks, ...googleBusy];

  // 對範圍內每一天(含前後各一天緩衝)套用同一份忙碌清單算空檔,
  // 不再對資料庫或 Google Calendar 額外發送任何請求。
  const slotsByDate = {};
  const firstDate = addDaysToDateStr(startDate, -1);
  const lastDate = addDaysToDateStr(endDate, 1);
  let cursor = firstDate;
  while (cursor <= lastDate) {
    const slots = getSlotsForDate({
      timeSlots,
      timezone: user.timezone || "Asia/Taipei",
      duration: eventType.duration,
      dateStr: cursor,
      existingBookings: busy,
      bufferMinutes: eventType.bufferMinutes || 0,
      minimumNoticeMinutes: eventType.minimumNoticeMinutes || 0,
    });
    slotsByDate[cursor] = slots.map((s) => s.start.toISOString());
    cursor = addDaysToDateStr(cursor, 1);
  }

  return NextResponse.json({
    slotsByDate,
    timezone: user.timezone || "Asia/Taipei",
  });
}
