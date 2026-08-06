import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import User from "@/models/User";
import { resend, EMAIL_FROM } from "@/libs/resend";
import { buildCancellationEmail } from "@/libs/emails/bookingConfirmation";
import { rateLimit, getClientIp } from "@/libs/rateLimit";

export async function POST(req, { params }) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`cancel:ip:${ip}`, 10, 10 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing cancellation token" }, { status: 400 });
    }

    await connectMongo();

    // token 要完全對上,不然任何人猜到 booking id 就能取消別人的預約
    const booking = await Booking.findOne({ _id: id, cancelToken: token }).populate(
      "eventType",
      "title"
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "cancelled") {
      return NextResponse.json({ booking }); // 已經取消過了,直接回傳現況
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancelReason = "Cancelled by invitee";
    await booking.save();

    const organizer = await User.findById(booking.organizer);

    await resend.emails
      .send({
        from: EMAIL_FROM,
        to: organizer?.email,
        ...buildCancellationEmail({
          eventTitle: booking.eventType?.title || "Event",
          organizerName: organizer?.name || "there",
          startTime: booking.startTime,
          endTime: booking.endTime,
          timezone: organizer?.timezone || "Asia/Taipei",
          inviteeName: booking.inviteeName,
        }),
      })
      .catch((e) => console.error("Failed to notify organizer of cancellation:", e.message));

    return NextResponse.json({ booking });
  } catch (e) {
    console.error("POST /api/public/bookings/[id]/cancel error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}

export async function GET(req, { params }) {
  // 給取消頁面載入時先顯示行程資訊用,一樣要帶正確的 token 才看得到
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing cancellation token" }, { status: 400 });
    }

    await connectMongo();

    const booking = await Booking.findOne({ _id: id, cancelToken: token }).populate(
      "eventType",
      "title duration location"
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({
      booking: {
        title: booking.eventType?.title || "Event",
        startTime: booking.startTime,
        endTime: booking.endTime,
        location: booking.eventType?.location || null,
        status: booking.status,
        inviteeName: booking.inviteeName,
      },
    });
  } catch (e) {
    console.error("GET /api/public/bookings/[id]/cancel error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}
