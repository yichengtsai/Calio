import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import EventType from "@/models/EventType";

// 給編輯頁預先帶入現有資料用
export async function GET(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;

  await connectMongo();

  const eventType = await EventType.findOne({ _id: id, user: session.user.id });
  if (!eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  return NextResponse.json({ eventType });
}

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const {
    title,
    description,
    duration,
    location,
    color,
    isActive,
    requiresApproval,
    bufferMinutes,
    minimumNoticeMinutes,
    reminderMinutesBefore,
  } = body;

  await connectMongo();

  const eventType = await EventType.findOne({ _id: id, user: session.user.id });
  if (!eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  if (title !== undefined) eventType.title = title;
  if (description !== undefined) eventType.description = description;
  if (duration !== undefined) {
    const durationNum = Number(duration);
    if (!Number.isFinite(durationNum) || durationNum < 5) {
      return NextResponse.json(
        { error: "Duration must be at least 5 minutes" },
        { status: 400 }
      );
    }
    eventType.duration = durationNum;
  }
  if (location !== undefined) eventType.location = location;
  if (color !== undefined) eventType.color = color;
  if (isActive !== undefined) eventType.isActive = isActive;
  if (requiresApproval !== undefined) eventType.requiresApproval = requiresApproval;
  if (bufferMinutes !== undefined) eventType.bufferMinutes = Number(bufferMinutes) || 0;
  if (minimumNoticeMinutes !== undefined)
    eventType.minimumNoticeMinutes = Number(minimumNoticeMinutes) || 0;
  if (reminderMinutesBefore !== undefined)
    eventType.reminderMinutesBefore = Number(reminderMinutesBefore) || 0;

  await eventType.save();

  return NextResponse.json({ eventType });
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;

  await connectMongo();

  const eventType = await EventType.findOneAndDelete({
    _id: id,
    user: session.user.id,
  });

  if (!eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
