import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Event from "@/models/Event";
import User from "@/models/User";
import { resend, EMAIL_FROM } from "@/libs/resend";
import { buildEventCancellationEmail } from "@/libs/emails/eventNotification";

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  if (status !== "cancelled") {
    return NextResponse.json(
      { error: "Only cancelling an event is supported here" },
      { status: 400 }
    );
  }

  await connectMongo();

  const event = await Event.findOne({ _id: id, organizer: session.user.id });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

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
