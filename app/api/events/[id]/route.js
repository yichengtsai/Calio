import { NextResponse, after } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Event from "@/models/Event";
import User from "@/models/User";
import { resend, EMAIL_FROM } from "@/libs/resend";
import {
  buildEventCancellationEmail,
  buildEventUpdateEmail,
  buildEventNotificationEmail,
} from "@/libs/emails/eventNotification";
import {
  pushEventToGoogleCalendar,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "@/libs/googleCalendar";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function GET(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;

  await connectMongo();

  const event = await Event.findOne({ _id: id, organizer: session.user.id });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ event });
}

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  await connectMongo();

  const event = await Event.findOne({ _id: id, organizer: session.user.id });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // ---- 取消整場會議 ----
  if (status === "cancelled") {
    if (event.status === "cancelled") {
      return NextResponse.json({ event });
    }

    event.status = "cancelled";
    await event.save();

    const organizer = await User.findById(session.user.id);
    const googleEventId = event.googleEventId;
    const participantsSnap = event.participants.map((p) => ({
      email: p.email,
      name: p.name,
    }));
    const cancelSnap = {
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      timezone: event.timezone,
      organizerName: organizer?.name || organizer?.email,
    };

    // Google 刪除與寄信改背景，先回前端
    after(async () => {
      if (googleEventId) {
        await deleteGoogleCalendarEvent(session.user.id, googleEventId);
      }
      await Promise.allSettled(
        participantsSnap.map((participant) =>
          resend.emails.send({
            from: EMAIL_FROM,
            to: participant.email,
            ...buildEventCancellationEmail({
              title: cancelSnap.title,
              startTime: cancelSnap.startTime,
              endTime: cancelSnap.endTime,
              timezone: cancelSnap.timezone,
              organizerName: cancelSnap.organizerName,
              participantName: participant.name,
            }),
          })
        )
      );
    });

    return NextResponse.json({ event });
  }

  if (status !== undefined) {
    return NextResponse.json(
      { error: "status can only be set to 'cancelled' here" },
      { status: 400 }
    );
  }

  if (event.status === "cancelled") {
    return NextResponse.json(
      { error: "Can't edit a cancelled event" },
      { status: 400 }
    );
  }

  const {
    title,
    description,
    startTime,
    endTime,
    timezone,
    location,
    meetingUrl,
    color,
    reminderMinutesBefore,
    participants: participantsBody,
    createGoogleMeet,
  } = body;

  const changedFields = [];
  const previousParticipants = (event.participants || []).map((p) => ({
    email: normalizeEmail(p.email),
    name: p.name,
    _id: p._id,
  }));

  if (title !== undefined) {
    if (!String(title).trim()) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    if (title !== event.title) changedFields.push("Title");
    event.title = title;
  }
  if (description !== undefined) {
    if ((description || "") !== (event.description || "")) changedFields.push("Description");
    event.description = description;
  }
  if (location !== undefined) {
    if ((location || "") !== (event.location || "")) changedFields.push("Location");
    event.location = location;
  }
  if (meetingUrl !== undefined) {
    if ((meetingUrl || "") !== (event.meetingUrl || "")) changedFields.push("Meeting link");
    event.meetingUrl = meetingUrl || undefined;
  }
  if (color !== undefined) event.color = color;
  if (timezone !== undefined) event.timezone = timezone;
  if (reminderMinutesBefore !== undefined) {
    event.reminderMinutesBefore = Number(reminderMinutesBefore) || 0;
  }

  if (startTime !== undefined || endTime !== undefined) {
    const newStart = startTime !== undefined ? new Date(startTime) : event.startTime;
    const newEnd = endTime !== undefined ? new Date(endTime) : event.endTime;

    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }
    if (newEnd <= newStart) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    if (
      newStart.getTime() !== event.startTime.getTime() ||
      newEnd.getTime() !== event.endTime.getTime()
    ) {
      changedFields.push("Time");
    }

    event.startTime = newStart;
    event.endTime = newEnd;
    event.reminderSentAt = undefined;
  }

  // ---- 參與者增減 ----
  let added = [];
  let removed = [];
  let staying = previousParticipants;

  if (participantsBody !== undefined) {
    if (!Array.isArray(participantsBody) || participantsBody.length === 0) {
      return NextResponse.json(
        { error: "At least one participant is required" },
        { status: 400 }
      );
    }

    const nextList = participantsBody
      .filter((p) => p?.email && String(p.email).trim())
      .map((p) => ({
        email: normalizeEmail(p.email),
        name: p.name ? String(p.name).trim() : undefined,
      }));

    // de-dupe by email
    const seen = new Set();
    const uniqueNext = [];
    for (const p of nextList) {
      if (seen.has(p.email)) continue;
      seen.add(p.email);
      uniqueNext.push(p);
    }

    if (uniqueNext.length === 0) {
      return NextResponse.json(
        { error: "At least one participant email is required" },
        { status: 400 }
      );
    }

    const prevMap = new Map(previousParticipants.map((p) => [p.email, p]));
    const nextEmails = new Set(uniqueNext.map((p) => p.email));

    removed = previousParticipants.filter((p) => !nextEmails.has(p.email));
    added = uniqueNext.filter((p) => !prevMap.has(p.email));
    staying = uniqueNext
      .filter((p) => prevMap.has(p.email))
      .map((p) => {
        const old = prevMap.get(p.email);
        return { email: p.email, name: p.name || old.name, _id: old._id };
      });

    if (removed.length || added.length) {
      changedFields.push("Participants");
    }

    // preserve _id for staying participants so confirm links still work
    event.participants = uniqueNext.map((p) => {
      const old = prevMap.get(p.email);
      if (old?._id) {
        return { _id: old._id, email: p.email, name: p.name, notifiedAt: undefined };
      }
      return { email: p.email, name: p.name };
    });
  }

  // ---- 改為線上 Meet ----
  if (createGoogleMeet && !event.meetingUrl) {
    if (event.googleEventId) {
      await deleteGoogleCalendarEvent(session.user.id, event.googleEventId);
      event.googleEventId = undefined;
    }

    const pushed = await pushEventToGoogleCalendar(
      session.user.id,
      {
        title: event.title,
        description: event.description,
        location: "Google Meet",
        startTime: event.startTime,
        endTime: event.endTime,
        timezone: event.timezone,
        participants: event.participants.map((p) => ({
          email: p.email,
          name: p.name,
        })),
      },
      { createMeet: true }
    );

    if (pushed) {
      if (typeof pushed === "string") {
        event.googleEventId = pushed;
      } else {
        event.googleEventId = pushed.id;
        if (pushed.meetingUrl) {
          event.meetingUrl = pushed.meetingUrl;
          event.location = event.location || "Google Meet";
          changedFields.push("Meeting link");
        }
      }
    }
  }

  await event.save();

  // 非 Meet 新建時，若已有 googleEventId 用 patch 更新（比刪掉重建快）
  if (event.googleEventId && !(createGoogleMeet && !event.meetingUrl)) {
    after(async () => {
      await updateGoogleCalendarEvent(session.user.id, event.googleEventId, {
        title: event.title,
        description: event.description,
        location: event.location,
        startTime: event.startTime,
        endTime: event.endTime,
        timezone: event.timezone,
      });
    });
  }

  const organizer = await User.findById(session.user.id);
  const emailsSent = (removed.length || 0) + (added.length || 0) + (changedFields.filter((f) => f !== "Participants").length > 0 ? 1 : 0);

  const emailJob = {
    userId: session.user.id,
    eventId: event._id.toString(),
    organizerName: organizer?.name || organizer?.email,
    removed: removed.map((p) => ({ email: p.email, name: p.name })),
    added: added.map((p) => ({ email: p.email, name: p.name })),
    stayingTargets:
      participantsBody !== undefined
        ? event.participants
            .filter(
              (p) =>
                !added.some((a) => a.email === normalizeEmail(p.email)) &&
                !removed.some((r) => r.email === normalizeEmail(p.email))
            )
            .map((p) => ({
              email: p.email,
              name: p.name,
              _id: p._id?.toString(),
            }))
        : event.participants.map((p) => ({
            email: p.email,
            name: p.name,
            _id: p._id?.toString(),
          })),
    detailChanges: changedFields.filter((f) => f !== "Participants"),
    snapshot: {
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      timezone: event.timezone,
      location: event.location,
      meetingUrl: event.meetingUrl,
    },
  };

  after(async () => {
    const { snapshot } = emailJob;
    if (emailJob.removed.length) {
      await Promise.allSettled(
        emailJob.removed.map((participant) =>
          resend.emails.send({
            from: EMAIL_FROM,
            to: participant.email,
            ...buildEventCancellationEmail({
              title: snapshot.title,
              startTime: snapshot.startTime,
              endTime: snapshot.endTime,
              timezone: snapshot.timezone,
              organizerName: emailJob.organizerName,
              participantName: participant.name,
            }),
          })
        )
      );
    }
    if (emailJob.added.length) {
      await Promise.allSettled(
        emailJob.added.map(async (person) => {
          const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${emailJob.eventId}/confirm?participant=`;
          const { subject, html } = buildEventNotificationEmail({
            title: snapshot.title,
            description: snapshot.description,
            startTime: snapshot.startTime,
            endTime: snapshot.endTime,
            timezone: snapshot.timezone,
            location: snapshot.location,
            meetingUrl: snapshot.meetingUrl,
            organizerName: emailJob.organizerName,
            participantName: person.name,
            confirmUrl,
          });
          await resend.emails.send({
            from: EMAIL_FROM,
            to: person.email,
            subject,
            html,
          });
        })
      );
    }
    if (emailJob.detailChanges.length > 0) {
      await Promise.allSettled(
        emailJob.stayingTargets.map(async (participant) => {
          const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${emailJob.eventId}/confirm?participant=${participant._id || ""}`;
          const { subject, html } = buildEventUpdateEmail({
            title: snapshot.title,
            description: snapshot.description,
            startTime: snapshot.startTime,
            endTime: snapshot.endTime,
            timezone: snapshot.timezone,
            location: snapshot.location,
            meetingUrl: snapshot.meetingUrl,
            organizerName: emailJob.organizerName,
            participantName: participant.name,
            confirmUrl,
            changedFields: emailJob.detailChanges,
          });
          await resend.emails.send({
            from: EMAIL_FROM,
            to: participant.email,
            subject,
            html,
          });
        })
      );
    }
  });

  return NextResponse.json({
    event,
    changedFields,
    emailsSent,
    emailsFailed: 0,
    addedCount: added.length,
    removedCount: removed.length,
  });
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;

  await connectMongo();

  const event = await Event.findOneAndDelete({ _id: id, organizer: session.user.id });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
