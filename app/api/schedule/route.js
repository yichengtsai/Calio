import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import Event from "@/models/Event";
import Block from "@/models/Block";
import User from "@/models/User";
import "@/models/EventType"; // 註冊 model 給 Booking 的 populate 用
import { listGoogleCalendarEvents } from "@/libs/googleCalendar";
import { canUseGoogleCalendarSync } from "@/libs/plans";

// 拉取 Google 事件的時間範圍:預設過去 7 天到未來 90 天,跟前端週曆瀏覽的合理範圍對齊,
// 避免把使用者整個 Google Calendar 歷史都抓下來。可用環境變數覆蓋,不用改程式碼重新部署。
const GOOGLE_PULL_WINDOW_PAST_DAYS = Number(process.env.GOOGLE_PULL_WINDOW_PAST_DAYS) || 7;
const GOOGLE_PULL_WINDOW_FUTURE_DAYS = Number(process.env.GOOGLE_PULL_WINDOW_FUTURE_DAYS) || 90;

// 把「別人在預約頁上訂的時段(Booking)」跟「自己手動建立、邀請別人的行程(Event)」
// 合併成同一種格式,給日曆頁統一顯示
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectMongo();

  const [user, bookings, events, blocks] = await Promise.all([
    User.findById(session.user.id),
    Booking.find({
      organizer: session.user.id,
      status: { $in: ["confirmed", "pending"] },
    }).populate("eventType", "title color location locationType"),
    Event.find({ organizer: session.user.id, status: { $ne: "cancelled" } }),
    Block.find({ user: session.user.id }),
  ]);

  // 這些 googleEventId 是 Calio 自己 push 上去的,拉回來的時候要排除掉,
  // 不然同一筆行程會在日曆上重複顯示兩次(一次來自本地資料,一次來自 Google)
  const knownGoogleEventIds = new Set(
    [...bookings, ...events]
      .map((item) => item.googleEventId)
      .filter(Boolean)
  );

  // 備援去重:萬一某筆本地資料的 googleEventId 沒存到(例如 push 成功但後續 save() 失敗、
  // 或是這個欄位還沒上線前建立的舊資料),單靠 id 比對會抓不到,改用開始時間當作次要判斷依據。
  // 用 Map<ISO 分鐘, true> 而不是逐筆比對,避免項目一多整個查詢變 O(n*m)。
  const knownLocalStartTimes = new Set(
    [...bookings, ...events].map((item) => new Date(item.startTime).toISOString())
  );

  let googleOnlyEvents = [];
  if (canUseGoogleCalendarSync(user)) {
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - GOOGLE_PULL_WINDOW_PAST_DAYS);
    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + GOOGLE_PULL_WINDOW_FUTURE_DAYS);

    const googleEvents = await listGoogleCalendarEvents(session.user.id, timeMin, timeMax);
    googleOnlyEvents = googleEvents.filter(
      (e) =>
        !knownGoogleEventIds.has(e.googleEventId) &&
        !knownLocalStartTimes.has(e.startTime.toISOString())
    );
  }

  const items = [
    ...bookings.map((b) => ({
      id: b._id.toString(),
      source: "booking",
      status: b.status, // "confirmed" | "pending" — 前端用這個決定要不要用虛線框
      title: b.eventType?.title || "Booking",
      subtitle: b.inviteeName,
      startTime: b.startTime,
      endTime: b.endTime,
      color: b.eventType?.color || "#6366f1",
      location:
        b.eventType?.locationType === "google_meet"
          ? "Google Meet"
          : b.eventType?.location || null,
      meetingUrl: b.meetingUrl || null,
      inviteeName: b.inviteeName,
      inviteeEmail: b.inviteeEmail,
      inviteeNotes: b.inviteeNotes || null,
    })),
    ...events.map((e) => ({
      id: e._id.toString(),
      source: "event",
      status: "confirmed", // Team Events 沒有待審核這個狀態,一律當作已確認
      title: e.title,
      subtitle:
        e.participants?.length
          ? `${e.participants.length} participant${e.participants.length === 1 ? "" : "s"}`
          : null,
      startTime: e.startTime,
      endTime: e.endTime,
      color: e.color || "#0ea5e9",
      location: e.location || null,
      meetingUrl: e.meetingUrl || null,
      description: e.description || null,
      participants: (e.participants || []).map((p) => ({
        name: p.name || null,
        email: p.email,
        status: p.status,
      })),
    })),
    ...blocks.map((b) => ({
      id: b._id.toString(),
      source: "block",
      status: "confirmed",
      title: b.title || "Busy",
      subtitle: null,
      startTime: b.startTime,
      endTime: b.endTime,
      color: b.color || "#6b7280",
      location: null,
      notes: b.notes || null,
    })),
    // 直接在 Google Calendar 上新增的事件(單向拉回來顯示,唯讀,不能在 Calio 這邊取消/編輯)
    ...googleOnlyEvents.map((e) => ({
      id: `google_${e.googleEventId}`,
      source: "google",
      status: "confirmed",
      title: e.title,
      subtitle: "From Google Calendar",
      startTime: e.startTime,
      endTime: e.endTime,
      color: "#34a853", // Google 品牌綠,一眼認得出是外部事件
      location: e.location,
      notes: null,
    })),
  ];

  return NextResponse.json({ items });
}
