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
  buildRescheduledEmail,
} from "@/libs/emails/bookingConfirmation";
import {
  pushEventToGoogleCalendar,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from "@/libs/googleCalendar";
import { canUseGoogleCalendarSync } from "@/libs/plans";

const ALLOWED_STATUSES = ["confirmed", "declined", "cancelled"];

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, cancelReason, startTime, endTime } = body;

  await connectMongo();

  const booking = await Booking.findOne({ _id: id, organizer: session.user.id }).populate(
    "eventType",
    "title location locationType"
  );
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const organizer = await User.findById(session.user.id);
  const timezone = organizer?.timezone || "Asia/Taipei";
  // 這幾封都是寄給「預約人」看的,時間要用他當初預約時選的時區,
  // 而不是主辦人的時區,不然對方看到信會覺得時間對不上
  const inviteeTimezone = booking.inviteeTimezone || timezone;

  // ---- 改期:body 帶 startTime/endTime,不帶 status ----
  if (status === undefined && (startTime !== undefined || endTime !== undefined)) {
    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: "Both startTime and endTime are required to reschedule" },
        { status: 400 }
      );
    }

    if (booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Only confirmed bookings can be rescheduled" },
        { status: 400 }
      );
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }
    if (newEnd <= newStart) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    const unchanged =
      newStart.getTime() === booking.startTime.getTime() &&
      newEnd.getTime() === booking.endTime.getTime();

    if (unchanged) {
      return NextResponse.json({ booking, rescheduled: false });
    }

    // 跟你自己其他已確認的預約撞期就擋掉(排除自己這一筆)
    const conflict = await Booking.findOne({
      _id: { $ne: booking._id },
      organizer: session.user.id,
      status: "confirmed",
      startTime: { $lt: newEnd },
      endTime: { $gt: newStart },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "This overlaps with another booking you already have confirmed" },
        { status: 409 }
      );
    }

    const previousStartTime = booking.startTime;
    const previousEndTime = booking.endTime;

    booking.startTime = newStart;
    booking.endTime = newEnd;
    // 時間改了,提醒信要重新算,不然可能已經寄過的提醒信對應到的是舊時間
    booking.reminderSentAt = undefined;
    await booking.save();

    // 同步更新 Google Calendar 上的事件(Pro 版)。
    // 如果先前這筆從沒同步成功過(例如當時使用者還沒連結 Google,或剛好是免費版升級成 Pro),
    // 這裡順便補推一筆新的,而不是放棄同步。
    if (canUseGoogleCalendarSync(organizer)) {
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
          session.user.id,
          booking.googleEventId,
          googleEvent
        );
        if (!stillThere) {
          // 原本那筆在 Google 那邊已經不在了,補推一筆新的
          const newGoogleEventId = await pushEventToGoogleCalendar(session.user.id, {
            ...googleEvent,
            participants: [{ email: booking.inviteeEmail, name: booking.inviteeName }],
          });
          booking.googleEventId = newGoogleEventId || undefined;
          await booking.save();
        }
      } else {
        const newGoogleEventId = await pushEventToGoogleCalendar(session.user.id, {
          ...googleEvent,
          participants: [{ email: booking.inviteeEmail, name: booking.inviteeName }],
        });
        if (newGoogleEventId) {
          booking.googleEventId = newGoogleEventId;
          await booking.save();
        }
      }
    }

    await resend.emails
      .send({
        from: EMAIL_FROM,
        to: booking.inviteeEmail,
        ...buildRescheduledEmail({
          eventTitle: booking.eventType?.title || "Event",
          organizerName: organizer?.name || organizer?.email,
          previousStartTime,
          previousEndTime,
          startTime: newStart,
          endTime: newEnd,
          timezone: inviteeTimezone,
          inviteeName: booking.inviteeName,
        }),
      })
      .catch((e) => console.error("Failed to send reschedule email:", e.message));

    return NextResponse.json({ booking, rescheduled: true });
  }

  // ---- 狀態變更:approve / decline / cancel ----
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "status must be one of: confirmed, declined, cancelled" },
      { status: 400 }
    );
  }

  if (booking.status === status) {
    return NextResponse.json({ booking }); // 已經是這個狀態了,直接回傳現況
  }

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

  // ---- Google Calendar 同步 ----
  if (canUseGoogleCalendarSync(organizer)) {
    if (status === "confirmed" && !booking.googleEventId) {
      const createMeet = booking.eventType?.locationType === "google_meet";
      const pushed = await pushEventToGoogleCalendar(
        session.user.id,
        {
          title: `${booking.eventType?.title || "Event"} with ${booking.inviteeName}`,
          description: booking.inviteeNotes || undefined,
          location: booking.eventType?.location,
          startTime: booking.startTime,
          endTime: booking.endTime,
          timezone,
          participants: [{ email: booking.inviteeEmail, name: booking.inviteeName }],
        },
        { createMeet }
      );
      if (pushed) {
        if (typeof pushed === "string") {
          booking.googleEventId = pushed;
        } else {
          booking.googleEventId = pushed.id;
          if (pushed.meetingUrl) booking.meetingUrl = pushed.meetingUrl;
        }
        await booking.save();
      }
    }
    } else if ((status === "cancelled" || status === "declined") && booking.googleEventId) {
      // 已經同步過的行程被取消/拒絕:把 Google Calendar 上的事件一併刪掉
      await deleteGoogleCalendarEvent(session.user.id, booking.googleEventId);
    }
  }

  let emailPayload = null;
  if (status === "confirmed") {
    emailPayload = buildInviteeConfirmationEmail({
      eventTitle: booking.eventType?.title || "Event",
      organizerName: organizer?.name || organizer?.email,
      startTime: booking.startTime,
      endTime: booking.endTime,
      timezone: inviteeTimezone,
      location:
        booking.eventType?.locationType === "google_meet"
          ? "Google Meet"
          : booking.eventType?.location,
      meetingUrl: booking.meetingUrl,
      inviteeName: booking.inviteeName,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/booking/${booking.id}/cancel?token=${booking.cancelToken}`,
    });
  } else if (status === "declined") {
    emailPayload = buildDeclinedEmail({
      eventTitle: booking.eventType?.title || "Event",
      organizerName: organizer?.name || organizer?.email,
      startTime: booking.startTime,
      endTime: booking.endTime,
      timezone: inviteeTimezone,
      inviteeName: booking.inviteeName,
    });
  } else if (status === "cancelled") {
    emailPayload = buildCancellationEmail({
      eventTitle: booking.eventType?.title || "Event",
      organizerName: organizer?.name || organizer?.email,
      startTime: booking.startTime,
      endTime: booking.endTime,
      timezone: inviteeTimezone,
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
