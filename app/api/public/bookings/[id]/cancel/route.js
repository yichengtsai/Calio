import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import User from "@/models/User";
import { resend, EMAIL_FROM } from "@/libs/resend";
import { buildCancellationEmail } from "@/libs/emails/bookingConfirmation";
import { rateLimit, getClientIp } from "@/libs/rateLimit";
import { deleteGoogleCalendarEvent } from "@/libs/googleCalendar";
import { canUseGoogleCalendarSync } from "@/libs/plans";

function cancellationDeadline(startTime, noticeMins) {
  const startMs =
    startTime instanceof Date
      ? startTime.getTime()
      : new Date(startTime).getTime();
  if (!Number.isFinite(startMs)) return null;
  const notice = Math.max(0, Number(noticeMins) || 0);
  // notice=0 → 截止 = 開始當下（開始後就不能取消）
  return new Date(startMs - notice * 60 * 1000);
}

function canCancelBooking(booking) {
  if (!booking) return { ok: false, error: "Booking not found" };
  if (booking.status === "cancelled") {
    return { ok: false, error: "This booking is already cancelled.", already: true };
  }
  if (
    booking.status === "declined" ||
    booking.status === "expired"
  ) {
    return {
      ok: false,
      error: "This booking can no longer be cancelled.",
    };
  }

  const noticeMins =
    Number(booking.eventType?.minimumNoticeMinutes) || 0;
  const deadline = cancellationDeadline(booking.startTime, noticeMins);
  if (!deadline) {
    return { ok: false, error: "Invalid booking time." };
  }

  if (Date.now() > deadline.getTime()) {
    return {
      ok: false,
      error:
        noticeMins > 0
          ? "This booking can no longer be cancelled — the cancellation deadline has passed."
          : "This booking has already started and can no longer be cancelled.",
      deadline: deadline.toISOString(),
      noticeMins,
    };
  }

  return { ok: true, deadline: deadline.toISOString(), noticeMins };
}

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
      return NextResponse.json(
        { error: "Missing cancellation token" },
        { status: 400 }
      );
    }

    await connectMongo();

    const booking = await Booking.findOne({
      _id: id,
      cancelToken: token,
    }).populate("eventType", "title minimumNoticeMinutes");

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "cancelled") {
      return NextResponse.json({ booking });
    }

    const check = canCancelBooking(booking);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancelReason = "Cancelled by invitee";
    await booking.save();

    const organizer = await User.findById(booking.organizer);

    if (booking.googleEventId && canUseGoogleCalendarSync(organizer)) {
      await deleteGoogleCalendarEvent(booking.organizer, booking.googleEventId);
    }

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
      .catch((e) =>
        console.error("Failed to notify organizer of cancellation:", e.message)
      );

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
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Missing cancellation token" },
        { status: 400 }
      );
    }

    await connectMongo();

    const booking = await Booking.findOne({
      _id: id,
      cancelToken: token,
    }).populate("eventType", "title duration location minimumNoticeMinutes");

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const check = canCancelBooking(booking);

    return NextResponse.json({
      booking: {
        title: booking.eventType?.title || "Event",
        startTime: booking.startTime,
        endTime: booking.endTime,
        location: booking.eventType?.location || null,
        status: booking.status,
        inviteeName: booking.inviteeName,
      },
      canCancel: check.ok,
      cancelDeadline: check.deadline || null,
      minimumNoticeMinutes: check.noticeMins ?? 0,
      cancelBlockedReason: check.ok ? null : check.error,
    });
  } catch (e) {
    console.error("GET /api/public/bookings/[id]/cancel error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}
