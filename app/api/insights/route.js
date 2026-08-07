import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import Event from "@/models/Event";
import User from "@/models/User";
import "@/models/EventType"; // 註冊 model 給 Booking 的 populate 用
import { canUseInsights } from "@/libs/plans";

const DEFAULT_TREND_MONTHS = 6;
const ALLOWED_TREND_MONTHS = [6, 12, 24]; // 前端 range 切換的合法值,避免有人手動亂打 query 拉太多資料
const RATE_WINDOW_DAYS = 90; // 取消率/回覆時間只看近 90 天,太舊的資料參考價值不大
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// 建一個「月份格線」的 Map,從 (endYear, endMonth) 往前推 monthsCount 個月。
// yearOffset 拿來做 YoY 對照:current 跟去年用一樣的 monthsCount,
// 只是 endYear 差 1,這樣兩個 Map 的月份會自動一一對應,不用另外處理 key 對應。
function buildMonthGrid(monthsCount, endYear, endMonth, { withYear = false } = {}) {
  const map = new Map();
  for (let i = 0; i < monthsCount; i++) {
    const d = new Date(endYear, endMonth - (monthsCount - 1) + i, 1);
    map.set(monthKey(d), {
      key: monthKey(d),
      label: d.toLocaleDateString("en-US", {
        month: "short",
        ...(withYear ? { year: "2-digit" } : {}),
      }),
      count: 0,
      hours: 0,
    });
  }
  return map;
}

function addToGrid(map, startTime, endTime) {
  const start = new Date(startTime);
  const bucket = map.get(monthKey(start));
  if (!bucket) return; // 落在查詢範圍外(理論上查詢已經濾過,這裡防呆)
  bucket.count += 1;
  bucket.hours += (new Date(endTime) - start) / 3600000;
}

function toTrendArray(map) {
  return [...map.values()].map((m) => ({
    ...m,
    hours: Math.round(m.hours * 10) / 10,
  }));
}

export async function GET(request) {
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

  const { searchParams } = new URL(request.url);
  const requestedMonths = Number(searchParams.get("months"));
  const trendMonths = ALLOWED_TREND_MONTHS.includes(requestedMonths)
    ? requestedMonths
    : DEFAULT_TREND_MONTHS;
  const compareYoy = searchParams.get("compare") === "yoy";

  const now = new Date();
  const rateWindowStart = new Date(now.getTime() - RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // 當年跟去年的月份格線各自的起始月,取兩者中較早的當查詢下限
  const currentGridStart = new Date(now.getFullYear(), now.getMonth() - (trendMonths - 1), 1);
  const prevYearGridStart = compareYoy
    ? new Date(now.getFullYear() - 1, now.getMonth() - (trendMonths - 1), 1)
    : currentGridStart;
  const queryStart = compareYoy ? prevYearGridStart : currentGridStart;

  const [bookings, events] = await Promise.all([
    Booking.find({
      organizer: session.user.id,
      $or: [{ startTime: { $gte: queryStart } }, { createdAt: { $gte: queryStart } }],
    }).populate("eventType", "title color"),
    Event.find({
      organizer: session.user.id,
      startTime: { $gte: queryStart },
    }),
  ]);

  const confirmedBookings = bookings.filter((b) => b.status === "confirmed");
  const activeEvents = events.filter((e) => e.status !== "cancelled");

  // ---- 月趨勢:目前選擇的區間(6/12/24 個月)每月的會議數 + 總時數 ----
  const currentGrid = buildMonthGrid(trendMonths, now.getFullYear(), now.getMonth(), {
    withYear: trendMonths > 12,
  });
  confirmedBookings.forEach((b) => addToGrid(currentGrid, b.startTime, b.endTime));
  activeEvents.forEach((e) => addToGrid(currentGrid, e.startTime, e.endTime));
  const monthlyTrend = toTrendArray(currentGrid);

  // ---- YoY 對照:同樣長度的區間,往前推 1 年,月份 index 跟 monthlyTrend 一一對應 ----
  let monthlyTrendPrevYear = null;
  if (compareYoy) {
    const prevGrid = buildMonthGrid(trendMonths, now.getFullYear() - 1, now.getMonth());
    confirmedBookings.forEach((b) => addToGrid(prevGrid, b.startTime, b.endTime));
    activeEvents.forEach((e) => addToGrid(prevGrid, e.startTime, e.endTime));
    monthlyTrendPrevYear = toTrendArray(prevGrid);
  }

  // ---- Event Type 排名:目前選擇區間內,已確認的預約數 ----
  const rankingMap = new Map();
  confirmedBookings
    .filter((b) => b.eventType && new Date(b.startTime) >= currentGridStart)
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
  const thisMonth = currentGrid.get(monthKey(now));
  const lastMonth = currentGrid.get(monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  const momChangePct =
    lastMonth && lastMonth.count > 0
      ? Math.round(((thisMonth.count - lastMonth.count) / lastMonth.count) * 100)
      : null;

  return NextResponse.json({
    monthlyTrend,
    monthlyTrendPrevYear,
    trendMonths,
    eventTypeRanking,
    cancellationRate,
    avgResponseMinutes,
    weekdayCounts,
    busiestWeekday,
    thisMonth: { count: thisMonth.count, hours: thisMonth.hours },
    momChangePct,
  });
}
