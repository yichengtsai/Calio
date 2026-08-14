import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Event from "@/models/Event";
import EventType from "@/models/EventType";
import User from "@/models/User";
import { resend, EMAIL_FROM } from "@/libs/resend";
import { buildEventNotificationEmail } from "@/libs/emails/eventNotification";
import {
  checkCalendarConflict,
  pushEventToGoogleCalendar,
} from "@/libs/googleCalendar";
import { findInternalConflicts, conflictErrorMessage } from "@/libs/conflicts";

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

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
    ignoreConflicts,
    createGoogleMeet, // true = 自動建立 Google Meet，寫入 meetingUrl 後再寄信
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

  const cleanedParticipants = participants
    .filter((p) => p?.email && String(p.email).trim())
    .map((p) => ({
      email: String(p.email).trim().toLowerCase(),
      name: p.name ? String(p.name).trim() : undefined,
    }));

  if (cleanedParticipants.length === 0) {
    return NextResponse.json(
      { error: "At least one participant email is required" },
      { status: 400 }
    );
  }

  await connectMongo();

  const organizer = await User.findById(session.user.id);

  // 與自己的預約 / 會議撞期一律擋下（不可略過）
  // 會議與預約之間也要留緩衝：取此主辦人所有活動類型的最大 buffer
  const eventTypes = await EventType.find({ user: session.user.id, isActive: true })
    .select("bufferMinutes")
    .lean();
  const maxBuffer = eventTypes.reduce(
    (m, et) => Math.max(m, Number(et.bufferMinutes) || 0),
    0
  );

  const internalConflicts = await findInternalConflicts({
    organizerId: session.user.id,
    start,
    end,
    bufferMinutes: maxBuffer,
  });
  if (internalConflicts.length > 0) {
    return NextResponse.json(
      {
        error: "conflict",
        message: conflictErrorMessage(internalConflicts),
        conflicts: internalConflicts,
        source: "internal",
      },
      { status: 409 }
    );
  }

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
        source: "google",
      },
      { status: 409 }
    );
  }

  const event = await Event.create({
    title,
    description,
    startTime: start,
    endTime: end,
    timezone: timezone || organizer?.timezone || "Asia/Taipei",
    location: location || undefined,
    meetingUrl: meetingUrl || undefined,
    color: color || undefined,
    reminderMinutesBefore:
      reminderMinutesBefore !== undefined ? Number(reminderMinutesBefore) || 0 : 30,
    organizer: session.user.id,
    participants: cleanedParticipants,
  });

  // 先同步 Google（可選建 Meet），再寄信，信裡才帶得到連結
  let syncedToGoogleCalendar = false;
  const wantMeet = Boolean(createGoogleMeet) && !event.meetingUrl;
  const pushed = await pushEventToGoogleCalendar(
    session.user.id,
    {
      title: event.title,
      description: event.description,
      location: event.location,
      startTime: event.startTime,
      endTime: event.endTime,
      timezone: event.timezone,
      participants: event.participants.map((p) => ({
        email: p.email,
        name: p.name,
      })),
    },
    { createMeet: wantMeet }
  );

  if (pushed) {
    if (typeof pushed === "string") {
      event.googleEventId = pushed;
    } else {
      event.googleEventId = pushed.id;
      if (pushed.meetingUrl) {
        event.meetingUrl = pushed.meetingUrl;
      }
    }
    syncedToGoogleCalendar = Boolean(event.googleEventId);
    await event.save();
  }

  const eventId = event._id.toString();
  const organizerSnapshot = {
    name: organizer?.name || organizer?.email,
  };
  const participantsSnapshot = event.participants.map((p) => ({
    _id: p._id?.toString(),
    email: p.email,
    name: p.name,
  }));
  const eventSnapshot = {
    title: event.title,
    description: event.description,
    startTime: event.startTime,
    endTime: event.endTime,
    timezone: event.timezone,
    location: event.location,
    meetingUrl: event.meetingUrl,
  };

  // 信不要擋回應：先回前端，背景再寄
  after(async () => {
    await Promise.allSettled(
      participantsSnapshot.map(async (participant) => {
        const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventId}/confirm?participant=${participant._id || ""}`;
        const { subject, html } = buildEventNotificationEmail({
          title: eventSnapshot.title,
          description: eventSnapshot.description,
          startTime: eventSnapshot.startTime,
          endTime: eventSnapshot.endTime,
          timezone: eventSnapshot.timezone,
          location: eventSnapshot.location,
          meetingUrl: eventSnapshot.meetingUrl,
          organizerName: organizerSnapshot.name,
          participantName: participant.name,
          confirmUrl,
        });
        await resend.emails.send({
          from: EMAIL_FROM,
          to: participant.email,
          subject,
          html,
        });
      })
    );
  });

  return NextResponse.json(
    {
      event,
      emailsSent: participantsSnapshot.length,
      emailsFailed: 0,
      syncedToGoogleCalendar,
      meetingUrl: event.meetingUrl || null,
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
