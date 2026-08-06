import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import "@/models/EventType"; // 註冊 model 給 populate 用
import { expireStalePendingBookings } from "@/libs/bookingExpiry";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    await connectMongo();

    // 每次查詢列表時,順手把逾時未審核的 pending 預約標記過期
    await expireStalePendingBookings(session.user.id);

    const bookings = await Booking.find({ organizer: session.user.id })
      .populate("eventType", "title duration color location")
      .sort({ startTime: -1 });

    return NextResponse.json({ bookings });
  } catch (e) {
    console.error("GET /api/bookings error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
