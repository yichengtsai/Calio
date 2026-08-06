import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Event from "@/models/Event";
import User from "@/models/User";
import { resend, EMAIL_FROM } from "@/libs/resend";
import {
  buildEventCancellationEmail,
  buildEventUpdateEmail,
} from "@/libs/emails/eventNotification";

// 給編輯頁預先帶入現有資料用
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

  // ---- 取消(原本就有的流程,維持不變) ----
  if (status === "cancelled") {
    if (event.status === "cancelled") {
      return NextResponse.json({ event }); // 已經取消過了
    }

    event.status = "cancelled";
    await event.save();

    const organizer = await User.findById(session.user.id);

    // 逐一寄取消通知信給每位參與者,單封失敗不擋住整體流程
    await Promise.allSettled(
      event.participants.map((participant) =>
        resend.emails.send({
          from: EMAIL_FROM,
          to: participant.email,
          ...buildEventCancellationEmail({
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            timezone: event.timezone,
            organizerName: organizer?.name || organizer?.email,
            participantName: participant.name,
          }),
        })
      )
    );

    return NextResponse.json({ event });
  }

  if (status !== undefined) {
    return NextResponse.json(
      { error: "status can only be set to 'cancelled' here" },
      { status: 400 }
    );
  }

  // ---- 一般欄位編輯 ----
  // 注意:編輯目前不會重新檢查 Google Calendar 衝突、不會同步更新到已推送的 Google Calendar 事件。
  // 但只要有任何欄位實際變動,就會重新寄一封「已更新」通知信給每位參與者(見下方 changedFields)。
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
  } = body;

  if (event.status === "cancelled") {
    return NextResponse.json(
      { error: "Can't edit a cancelled event" },
      { status: 400 }
    );
  }

  // 先記錄使用者看得懂的「哪些欄位變了」,只比對訪客實際會看到的資訊
  // (title / description / time / location / meetingUrl),顏色、提醒設定這種純內部設定不算。
  const changedFields = [];

  if (title !== undefined) {
    if (!title.trim()) {
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
    event.meetingUrl = meetingUrl;
  }
  if (color !== undefined) event.color = color;
  if (timezone !== undefined) event.timezone = timezone;
  if (reminderMinutesBefore !== undefined)
    event.reminderMinutesBefore = Number(reminderMinutesBefore) || 0;

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
    // 時間改了就重置提醒寄送狀態,不然可能已經寄過的提醒信對應到的是舊時間
    event.reminderSentAt = undefined;
  }

  await event.save();

  // ---- 只要有訪客看得到的欄位真的變了,就重新通知每一位參與者 ----
  let emailsSent = 0;
  let emailsFailed = 0;

  if (changedFields.length > 0) {
    const organizer = await User.findById(session.user.id);

    const emailResults = await Promise.allSettled(
      event.participants.map(async (participant) => {
        const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${event._id}/confirm?participant=${participant._id}`;

        const { subject, html } = buildEventUpdateEmail({
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
          changedFields,
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

    emailsFailed = emailResults.filter((r) => r.status === "rejected").length;
    emailsSent = event.participants.length - emailsFailed;

    await event.save();
  }

  return NextResponse.json({ event, changedFields, emailsSent, emailsFailed });
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
