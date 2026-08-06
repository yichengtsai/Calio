import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import Event from "@/models/Event";
import User from "@/models/User";
import "@/models/EventType"; // 註冊 model 給 Booking 的 populate 用
import { canUseInsights } from "@/libs/plans";

const MONTHS_OF_TREND = 6;
const RATE_WINDOW_DAYS = 90; // 取消率/回覆時間只看近 90 天,太舊的資料參考價值不大
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectMongo();
  const user = await User.findById(session.user.id);

  if (!canUseInsights(user)) {
    return NextResponse.json(
      { error: "Insights is a Pro feature. Upgrade to see your scheduling analytics." },
      { status: 403 }
    );
  }

  const now = new Date();
  // 6 個月前的月初,當作這次查詢資料的下限——月趨勢跟近 90 天的取消率/回覆時間統計都在這個範圍內
  const trendStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_OF_TREND - 1), 1);
  const rateWindowStart = new Date(now.getTime() - RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [bookings, events] = await Promise.all([
    Booking.find({
      organizer: session.user.id,
      $or: [{ startTime: { $gte: trendStart } }, { createdAt: { $gte: trendStart } }],
    }).populate("eventType", "title color"),
    Event.find({
      organizer: session.user.id,
      startTime: { $gte: trendStart },
    }),
  ]);

  // ---- 月趨勢:近 6 個月每月的會議數 + 總時數(只算已確認/未取消的) ----
  const trendMap = new Map();
  for (let i = 0; i < MONTHS_OF_TREND; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_OF_TREND - 1) + i, 1);
    trendMap.set(monthKey(d), {
      key: monthKey(d),
      label: d.toLocaleDateString("en-US", { month: "short" }),
      count: 0,
      hours: 0,
    });
  }

  function addToTrend(startTime, endTime) {
    const start = new Date(startTime);
    const bucket = trendMap.get(monthKey(start));
    if (!bucket) return; // 落在 6 個月範圍外(理論上查詢已經濾過,這裡防呆)
    bucket.count += 1;
    bucket.hours += (new Date(endTime) - start) / 3600000;
  }

  bookings
    .filter((b) => b.status === "confirmed")
    .forEach((b) => addToTrend(b.startTime, b.endTime));
  events
    .filter((e) => e.status !== "cancelled")
    .forEach((e) => addToTrend(e.startTime, e.endTime));

  const monthlyTrend = [...trendMap.values()].map((m) => ({
    ...m,
    hours: Math.round(m.hours * 10) / 10,
  }));

  // ---- Event Type 排名:近 6 個月,已確認的預約數 ----
  const rankingMap = new Map();
  bookings
    .filter((b) => b.status === "confirmed" && b.eventType)
    .forEach((b) => {
      const id = b.eventType._id.toString();
      const entry = rankingMap.get(id) || {
        title: b.eventType.title,
        color: b.eventType.color || "#6366f1",
        count: 0,
      };
      entry.count += 1;
      rankingMap.set(id, entry);
    });
  const eventTypeRanking = [...rankingMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  // ---- 取消/被拒率:近 90 天,分母是「已有結果」的預約(pending 還沒結果,不算) ----
  const recentBookings = bookings.filter((b) => new Date(b.createdAt) >= rateWindowStart);
  const resolved = recentBookings.filter((b) =>
    ["confirmed", "cancelled", "declined", "expired"].includes(b.status)
  );
  const notCompleted = resolved.filter((b) => b.status !== "confirmed");
  const cancellationRate =
    resolved.length > 0 ? Math.round((notCompleted.length / resolved.length) * 100) : null;

  // ---- 平均回覆時間:建立 -> 主辦人回應(approve/decline),只看近 90 天有回應紀錄的 ----
  const responded = recentBookings.filter((b) => b.respondedAt);
  const avgResponseMinutes =
    responded.length > 0
      ? Math.round(
          responded.reduce(
            (sum, b) => sum + (new Date(b.respondedAt) - new Date(b.createdAt)) / 60000,
            0
          ) / responded.length
        )
      : null;

  // ---- 星期分布:近 90 天,已確認的預約落在星期幾比較多 ----
  const weekdayCountsArr = new Array(7).fill(0);
  recentBookings
    .filter((b) => b.status === "confirmed")
    .forEach((b) => {
      weekdayCountsArr[new Date(b.startTime).getDay()] += 1;
    });
  const weekdayCounts = weekdayCountsArr.map((count, i) => ({
    label: WEEKDAY_LABELS[i],
    count,
  }));
  const busiestWeekday = weekdayCountsArr.some((c) => c > 0)
    ? WEEKDAY_LABELS[weekdayCountsArr.indexOf(Math.max(...weekdayCountsArr))]
    : null;

  // ---- 這個月 vs 上個月 ----
  const thisMonth = trendMap.get(monthKey(now));
  const lastMonth = trendMap.get(monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  const momChangePct =
    lastMonth && lastMonth.count > 0
      ? Math.round(((thisMonth.count - lastMonth.count) / lastMonth.count) * 100)
      : null;

  return NextResponse.json({
    monthlyTrend,
    eventTypeRanking,
    cancellationRate,
    avgResponseMinutes,
    weekdayCounts,
    busiestWeekday,
    thisMonth: { count: thisMonth.count, hours: thisMonth.hours },
    momChangePct,
  });
}
