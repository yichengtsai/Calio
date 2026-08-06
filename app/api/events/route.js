import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Event from "@/models/Event";
import User from "@/models/User";
import { resend, EMAIL_FROM } from "@/libs/resend";
import { buildEventNotificationEmail } from "@/libs/emails/eventNotification";
import {
  checkCalendarConflict,
  pushEventToGoogleCalendar,
} from "@/libs/googleCalendar";

export async function POST(req) {
  // 1. 驗證登入狀態
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // 2. 簡單驗證輸入資料(沒有用 zod,先手動檢查必要欄位)
  const body = await req.json();
  const {
    title,
    description,
    startTime,
    endTime,
    timezone,
    location,
    meetingUrl,
    color,
    participants,
    reminderMinutesBefore,
    ignoreConflicts, // 使用者已經看過衝突警告,選擇「還是要建立」時前端會帶這個 true
  } = body;

  if (!title || !startTime || !endTime || !participants?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 }
    );
  }

  await connectMongo();

  const organizer = await User.findById(session.user.id);

  // 3. 用 Google Free/Busy API 檢查主辦人這段時間是否已有其他行程
  //    checked=false 代表沒連結 Google Calendar,不擋流程
  const { checked, conflicts } = await checkCalendarConflict(
    session.user.id,
    start,
    end
  );

  if (checked && conflicts.length > 0 && !ignoreConflicts) {
    return NextResponse.json(
      {
        error: "conflict",
        message: "This time overlaps with an existing event on your Google Calendar",
        conflicts,
      },
      { status: 409 }
    );
  }

  // 4. 建立 Event(participants 是 embedded subdocuments)
  const event = await Event.create({
    title,
    description,
    startTime: start,
    endTime: end,
    timezone: timezone || "Asia/Taipei",
    location,
    meetingUrl: meetingUrl || undefined,
    color: color || undefined,
    reminderMinutesBefore:
      reminderMinutesBefore !== undefined ? Number(reminderMinutesBefore) || 0 : 30,
    organizer: session.user.id,
    participants: participants
      .filter((p) => p.email)
      .map((p) => ({ email: p.email, name: p.name })),
  });

  // 5. 逐一寄送通知信(單封失敗不中斷整體流程)
  const emailResults = await Promise.allSettled(
    event.participants.map(async (participant) => {
      const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${event._id}/confirm?participant=${participant._id}`;

      const { subject, html } = buildEventNotificationEmail({
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        timezone: event.timezone,
        location: event.location,
        meetingUrl: event.meetingUrl,
        organizerName: organizer?.name || organizer?.email,
        participantName: participant.name,
        confirmUrl,
      });

      await resend.emails.send({
        from: EMAIL_FROM,
        to: participant.email,
        subject,
        html,
      });

      participant.notifiedAt = new Date();
    })
  );

  // 6. 寫回主辦人的 Google Calendar(失敗不影響已建立的行程,只是沒同步成功)
  const googleEventId = await pushEventToGoogleCalendar(session.user.id, event);
  if (googleEventId) {
    event.googleEventId = googleEventId;
  }

  await event.save();

  const failedCount = emailResults.filter((r) => r.status === "rejected").length;

  return NextResponse.json(
    {
      event,
      emailsSent: event.participants.length - failedCount,
      emailsFailed: failedCount,
      syncedToGoogleCalendar: Boolean(googleEventId),
    },
    { status: 201 }
  );
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectMongo();

  const events = await Event.find({ organizer: session.user.id }).sort({
    startTime: 1,
  });

  return NextResponse.json({ events });
}
