import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import User from "@/models/User";
import EventType from "@/models/EventType";
import { resend, EMAIL_FROM } from "@/libs/resend";
import {
  buildRescheduledEmail,
} from "@/libs/emails/bookingConfirmation";
import { rateLimit, getClientIp } from "@/libs/rateLimit";
import {
  updateGoogleCalendarEvent,
  pushEventToGoogleCalendar,
} from "@/libs/googleCalendar";
import { canUseGoogleCalendarSync } from "@/libs/plans";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "";
}

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    await connectMongo();

    const booking = await Booking.findOne({ _id: id, cancelToken: token }).populate(
      "eventType",
      "title duration location locationType slug"
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const organizer = await User.findById(booking.organizer).select(
      "name email username timezone"
    );

    return NextResponse.json({
      booking: {
        id: booking._id.toString(),
        title: booking.eventType?.title || "Event",
        startTime: booking.startTime,
        endTime: booking.endTime,
        duration: booking.eventType?.duration || 30,
        location: booking.eventType?.location || null,
        status: booking.status,
        inviteeName: booking.inviteeName,
        inviteeTimezone: booking.inviteeTimezone || null,
        meetingUrl: booking.meetingUrl || null,
      },
      organizer: {
        name: organizer?.name || organizer?.email || "Host",
        username: organizer?.username || null,
        timezone: organizer?.timezone || "Asia/Taipei",
      },
      eventType: {
        slug: booking.eventType?.slug || null,
        duration: booking.eventType?.duration || 30,
      },
      cancelUrl: `${appUrl()}/booking/${booking._id}/cancel?token=${token}`,
    });
  } catch (e) {
    console.error("GET /api/public/bookings/[id]/reschedule error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}

export async function POST(req, { params }) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`reschedule:ip:${ip}`, 15, 10 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { token, startTime } = body;

    if (!token || !startTime) {
      return NextResponse.json(
        { error: "Missing token or startTime" },
        { status: 400 }
      );
    }

    await connectMongo();

    const booking = await Booking.findOne({ _id: id, cancelToken: token }).populate(
      "eventType",
      "title duration location locationType slug"
    );

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "cancelled" || booking.status === "declined") {
      return NextResponse.json(
        { error: "This booking can no longer be rescheduled" },
        { status: 400 }
      );
    }

    if (booking.status !== "confirmed" && booking.status !== "pending") {
      return NextResponse.json(
        { error: "This booking cannot be rescheduled" },
        { status: 400 }
      );
    }

    const duration = booking.eventType?.duration || 30;
    const newStart = new Date(startTime);
    if (Number.isNaN(newStart.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }
    const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);

    if (newStart.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Please choose a future time" },
        { status: 400 }
      );
    }

    const unchanged =
      newStart.getTime() === booking.startTime.getTime() &&
      newEnd.getTime() === booking.endTime.getTime();
    if (unchanged) {
      return NextResponse.json({ booking, rescheduled: false });
    }

    // 與主辦人其他已確認預約撞期（排除自己）
    const conflict = await Booking.findOne({
      _id: { $ne: booking._id },
      organizer: booking.organizer,
      status: "confirmed",
      startTime: { $lt: newEnd },
      endTime: { $gt: newStart },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "That time is no longer available. Please pick another slot." },
        { status: 409 }
      );
    }

    const previousStartTime = booking.startTime;
    const previousEndTime = booking.endTime;

    booking.startTime = newStart;
    booking.endTime = newEnd;
    booking.reminderSentAt = undefined;
    await booking.save();

    const organizer = await User.findById(booking.organizer);
    const timezone = organizer?.timezone || "Asia/Taipei";
    const inviteeTimezone = booking.inviteeTimezone || timezone;

    if (canUseGoogleCalendarSync(organizer) || booking.googleEventId) {
      const googleEvent = {
        title: `${booking.eventType?.title || "Event"} with ${booking.inviteeName}`,
        description: booking.inviteeNotes || undefined,
        location: booking.eventType?.location,
        startTime: newStart,
        endTime: newEnd,
        timezone,
      };

      if (booking.googleEventId) {
        const stillThere = await updateGoogleCalendarEvent(
          booking.organizer.toString(),
          booking.googleEventId,
          googleEvent
        );
        if (!stillThere) {
          const pushed = await pushEventToGoogleCalendar(booking.organizer.toString(), {
            ...googleEvent,
            participants: [{ email: booking.inviteeEmail, name: booking.inviteeName }],
          });
          if (pushed) {
            booking.googleEventId = typeof pushed === "string" ? pushed : pushed.id;
            await booking.save();
          }
        }
      } else if (canUseGoogleCalendarSync(organizer)) {
        const pushed = await pushEventToGoogleCalendar(booking.organizer.toString(), {
          ...googleEvent,
          participants: [{ email: booking.inviteeEmail, name: booking.inviteeName }],
        });
        if (pushed) {
          booking.googleEventId = typeof pushed === "string" ? pushed : pushed.id;
          await booking.save();
        }
      }
    }

    const cancelUrl = `${appUrl()}/booking/${booking._id}/cancel?token=${token}`;
    const rescheduleUrl = `${appUrl()}/booking/${booking._id}/reschedule?token=${token}`;

    const inviteeMail = buildRescheduledEmail({
      eventTitle: booking.eventType?.title || "Event",
      organizerName: organizer?.name || organizer?.email,
      previousStartTime,
      previousEndTime,
      startTime: newStart,
      endTime: newEnd,
      timezone: inviteeTimezone,
      inviteeName: booking.inviteeName,
      cancelUrl,
      rescheduleUrl,
    });

    // 通知主辦人
    const organizerWhen = new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timezone,
    }).format(newStart);

    await Promise.allSettled([
      resend.emails.send({
        from: EMAIL_FROM,
        to: booking.inviteeEmail,
        ...inviteeMail,
      }),
      organizer?.email
        ? resend.emails.send({
            from: EMAIL_FROM,
            to: organizer.email,
            subject: `Rescheduled: ${booking.inviteeName} — ${booking.eventType?.title || "Booking"}`,
            html: `<p>${booking.inviteeName} rescheduled their booking.</p>
              <p><strong>New time:</strong> ${organizerWhen} (${timezone})</p>
              <p>Previous time was updated on your calendar if Google sync is connected.</p>`,
          })
        : Promise.resolve(),
    ]);

    return NextResponse.json({
      booking: {
        id: booking._id.toString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      },
      rescheduled: true,
    });
  } catch (e) {
    console.error("POST /api/public/bookings/[id]/reschedule error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}
