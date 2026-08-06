import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import EventType from "@/models/EventType";
import Booking from "@/models/Booking";
import Event from "@/models/Event";
import { resend, EMAIL_FROM } from "@/libs/resend";
import { rateLimit, getClientIp } from "@/libs/rateLimit";
import {
  buildRequestReceivedEmail,
  buildOrganizerNotificationEmail,
  buildInviteeConfirmationEmail,
  buildOrganizerAutoConfirmedEmail,
} from "@/libs/emails/bookingConfirmation";
import { checkCalendarConflict, pushEventToGoogleCalendar } from "@/libs/googleCalendar";
import { canUseGoogleCalendarSync } from "@/libs/plans";

export async function POST(req) {
  try {
    // 同一個 IP 10 分鐘內最多建立 5 筆預約請求,擋掉批次濫用
    const ip = getClientIp(req);
    const ipLimit = rateLimit(`booking:ip:${ip}`, 5, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      username,
      slug,
      startTime,
      inviteeName,
      inviteeEmail,
      inviteeNotes,
      inviteeTimezone,
    } = body;

    if (!username || !slug || !startTime || !inviteeName || !inviteeEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (inviteeName.length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or fewer" },
        { status: 400 }
      );
    }
    if (inviteeNotes && inviteeNotes.length > 1000) {
      return NextResponse.json(
        { error: "Notes must be 1000 characters or fewer" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    // 同一個 email 1 小時內最多被拿來建立 3 筆預約請求,擋掉「拿別人 email 灌爆信箱」這種濫用
    const emailLimit = rateLimit(
      `booking:email:${inviteeEmail.toLowerCase()}`,
      3,
      60 * 60 * 1000
    );
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: "Too many booking requests for this email. Please try again later." },
        { status: 429 }
      );
    }

    await connectMongo();

    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const eventType = await EventType.findOne({
      user: user._id,
      slug,
      isActive: true,
    });
    if (!eventType) {
      return NextResponse.json({ error: "Event type not found" }, { status: 404 });
    }

    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }
    if (start.getTime() <= Date.now()) {
      return NextResponse.json({ error: "This time has already passed" }, { status: 400 });
    }

    const end = new Date(start.getTime() + eventType.duration * 60000);

    // 防止兩個人幾乎同時搶同一個時段(race condition),也要擋掉主辦人自己建立的行程
    const [bookingConflict, eventConflict] = await Promise.all([
      Booking.findOne({
        organizer: user._id,
        status: "confirmed",
        startTime: { $lt: end },
        endTime: { $gt: start },
      }),
      Event.findOne({
        organizer: user._id,
        status: { $ne: "cancelled" },
        startTime: { $lt: end },
        endTime: { $gt: start },
      }),
    ]);
    if (bookingConflict || eventConflict) {
      return NextResponse.json(
        {
          error: "This time slot was just booked by someone else. Please pick another.",
        },
        { status: 409 }
      );
    }

    // Pro 版:除了我們自己資料庫裡的紀錄,也即時查一次主辦人本人的 Google Calendar,
    // 擋掉「這個人在 Google Calendar 上其實已經有別的事,只是沒同步進 Calio」這種情況。
    // checked=false(沒連結 Google Calendar,或查詢失敗)不擋流程。
    if (canUseGoogleCalendarSync(user)) {
      const { checked, conflicts } = await checkCalendarConflict(user._id, start, end);
      if (checked && conflicts.length > 0) {
        return NextResponse.json(
          {
            error:
              "This time was just taken on the organizer's calendar. Please pick another.",
          },
          { status: 409 }
        );
      }
    }

    const booking = await Booking.create({
      eventType: eventType._id,
      organizer: user._id,
      inviteeName,
      inviteeEmail,
      inviteeNotes: inviteeNotes || undefined,
      inviteeTimezone: inviteeTimezone || undefined,
      startTime: start,
      endTime: end,
      status: eventType.requiresApproval ? "pending" : "confirmed",
    });

    const timezone = user.timezone || "Asia/Taipei";
    // 寄給預約人自己的信,時間要用他預約當下選的時區顯示,不是主辦人的時區
    const inviteeDisplayTimezone = inviteeTimezone || timezone;
    const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings`;
    // 讓對方不用登入就能取消自己這筆預約的連結,靠 cancelToken 驗證身份
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/booking/${booking.id}/cancel?token=${booking.cancelToken}`;

    if (eventType.requiresApproval) {
      // 需要審核:對方收到「請求已送出,等待審核」,主辦人收到「有一筆需要你審核」
      await Promise.allSettled([
        resend.emails.send({
          from: EMAIL_FROM,
          to: inviteeEmail,
          ...buildRequestReceivedEmail({
            eventTitle: eventType.title,
            organizerName: user.name || user.email,
            startTime: start,
            endTime: end,
            timezone: inviteeDisplayTimezone,
            inviteeName,
            cancelUrl,
          }),
        }),
        resend.emails.send({
          from: EMAIL_FROM,
          to: user.email,
          ...buildOrganizerNotificationEmail({
            eventTitle: eventType.title,
            startTime: start,
            endTime: end,
            timezone,
            location: eventType.location,
            inviteeName,
            inviteeEmail,
            inviteeNotes,
            reviewUrl,
          }),
        }),
      ]);
    } else {
      // 自動確認:立刻寫回主辦人的 Google Calendar(Pro 版),讓對方在自己的行事曆上馬上看到這筆
      // 行程,不用等他自己回來後台看。失敗不影響預約本身,只是那次沒同步成功。
      if (canUseGoogleCalendarSync(user)) {
        const googleEventId = await pushEventToGoogleCalendar(user._id, {
          title: `${eventType.title} with ${inviteeName}`,
          description: inviteeNotes || undefined,
          location: eventType.location,
          startTime: start,
          endTime: end,
          timezone,
          participants: [{ email: inviteeEmail, name: inviteeName }],
        });
        if (googleEventId) {
          booking.googleEventId = googleEventId;
          await booking.save();
        }
      }

      // 雙邊都直接收到確認信,不用你動手
      await Promise.allSettled([
        resend.emails.send({
          from: EMAIL_FROM,
          to: inviteeEmail,
          ...buildInviteeConfirmationEmail({
            eventTitle: eventType.title,
            organizerName: user.name || user.email,
            startTime: start,
            endTime: end,
            timezone: inviteeDisplayTimezone,
            location: eventType.location,
            inviteeName,
            cancelUrl,
          }),
        }),
        resend.emails.send({
          from: EMAIL_FROM,
          to: user.email,
          ...buildOrganizerAutoConfirmedEmail({
            eventTitle: eventType.title,
            startTime: start,
            endTime: end,
            timezone,
            location: eventType.location,
            inviteeName,
            inviteeEmail,
            inviteeNotes,
          }),
        }),
      ]);
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (e) {
    console.error("POST /api/public/bookings error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}
