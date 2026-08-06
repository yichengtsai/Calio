import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import Event from "@/models/Event";
import Block from "@/models/Block";
import "@/models/EventType"; // 註冊 model 給 Booking 的 populate 用

// 把「別人在預約頁上訂的時段(Booking)」跟「自己手動建立、邀請別人的行程(Event)」
// 合併成同一種格式,給日曆頁統一顯示
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectMongo();

  const [bookings, events, blocks] = await Promise.all([
    Booking.find({
      organizer: session.user.id,
      status: { $in: ["confirmed", "pending"] },
    }).populate("eventType", "title color"),
    Event.find({ organizer: session.user.id, status: { $ne: "cancelled" } }),
    Block.find({ user: session.user.id }),
  ]);

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
      location: b.eventType?.location || null,
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
  ];

  return NextResponse.json({ items });
}
