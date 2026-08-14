import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import "@/models/EventType";
import { expireStalePendingBookings } from "@/libs/bookingExpiry";

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    await connectMongo();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // optional filter
    const limit = Math.min(Number(searchParams.get("limit")) || 200, 500);

    // 過期清理改為非阻塞，不拖慢列表回應
    void expireStalePendingBookings(session.user.id).catch((e) =>
      console.error("expireStalePendingBookings:", e.message)
    );

    const query = { organizer: session.user.id };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .select(
        "eventType inviteeName inviteeEmail inviteeNotes inviteeTimezone startTime endTime status cancelReason meetingUrl createdAt respondedAt cancelledAt"
      )
      .populate("eventType", "title duration color location")
      .sort({ startTime: -1 })
      .limit(limit)
      .lean();

    // lean 後補 id 給前端
    const mapped = bookings.map((b) => ({
      ...b,
      id: String(b._id),
      eventType: b.eventType
        ? { ...b.eventType, id: String(b.eventType._id) }
        : b.eventType,
    }));

    return NextResponse.json({ bookings: mapped });
  } catch (e) {
    console.error("GET /api/bookings error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
