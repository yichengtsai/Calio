import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import User from "@/models/User";
import { resend, EMAIL_FROM } from "@/libs/resend";
import {
  buildCancellationEmail,
  buildInviteeConfirmationEmail,
  buildDeclinedEmail,
} from "@/libs/emails/bookingConfirmation";

const ALLOWED_STATUSES = ["confirmed", "declined", "cancelled"];

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, cancelReason } = body;

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "status must be one of: confirmed, declined, cancelled" },
      { status: 400 }
    );
  }

  await connectMongo();

  const booking = await Booking.findOne({ _id: id, organizer: session.user.id }).populate(
    "eventType",
    "title"
  );
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status === status) {
    return NextResponse.json({ booking }); // 已經是這個狀態了,直接回傳現況
  }

  const organizer = await User.findById(session.user.id);
  const timezone = organizer?.timezone || "Asia/Taipei";

  // 同意前再檢查一次有沒有跟「已確認」的行程衝突(避免同一時段有兩個待審核請求,你先同意了另一個)
  if (status === "confirmed") {
    const conflict = await Booking.findOne({
      _id: { $ne: booking._id },
      organizer: session.user.id,
      status: "confirmed",
      startTime: { $lt: booking.endTime },
      endTime: { $gt: booking.startTime },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "This overlaps with a booking you've already confirmed" },
        { status: 409 }
      );
    }
  }

  booking.status = status;
  booking.respondedAt = new Date();
  if (status === "cancelled") {
    booking.cancelledAt = new Date();
    booking.cancelReason = cancelReason || undefined;
  }
  await booking.save();

  let emailPayload = null;
  if (status === "confirmed") {
    emailPayload = buildInviteeConfirmationEmail({
      eventTitle: booking.eventType?.title || "Event",
      organizerName: organizer?.name || organizer?.email,
      startTime: booking.startTime,
      endTime: booking.endTime,
      timezone,
      inviteeName: booking.inviteeName,
    });
  } else if (status === "declined") {
    emailPayload = buildDeclinedEmail({
      eventTitle: booking.eventType?.title || "Event",
      organizerName: organizer?.name || organizer?.email,
      startTime: booking.startTime,
      endTime: booking.endTime,
      timezone,
      inviteeName: booking.inviteeName,
    });
  } else if (status === "cancelled") {
    emailPayload = buildCancellationEmail({
      eventTitle: booking.eventType?.title || "Event",
      organizerName: organizer?.name || organizer?.email,
      startTime: booking.startTime,
      endTime: booking.endTime,
      timezone,
      inviteeName: booking.inviteeName,
    });
  }

  if (emailPayload) {
    await resend.emails
      .send({ from: EMAIL_FROM, to: booking.inviteeEmail, ...emailPayload })
      .catch((e) => console.error(`Failed to send ${status} email:`, e.message));
  }

  return NextResponse.json({ booking });
}
