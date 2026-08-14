import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import EventType from "@/models/EventType";

const LOCATION_TYPES = ["google_meet", "in_person", "phone", "custom"];

function normalizeLocationType(value) {
  if (!value) return "custom";
  if (value === "video") return "google_meet";
  if (LOCATION_TYPES.includes(value)) return value;
  return "custom";
}

export async function GET(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;

  await connectMongo();

  // lean：直接回傳 DB 文件上的欄位
  const eventType = await EventType.findOne({ _id: id, user: session.user.id }).lean();
  if (!eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  return NextResponse.json({
    eventType: {
      ...eventType,
      id: String(eventType._id),
      slotIntervalMinutes: Number(eventType.slotIntervalMinutes) || 0,
      bufferMinutes: Number(eventType.bufferMinutes) || 0,
    },
  });
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
    locationType,
    color,
    isActive,
    requiresApproval,
    bufferMinutes,
    slotIntervalMinutes,
    minimumNoticeMinutes,
    bookingWindowDays,
    maxBookingsPerDay,
    reminderMinutesBefore,
    reminderOffsets,
    policyNotes,
    ctaButtonText,
    successTitle,
    successMessage,
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
  if (locationType !== undefined) eventType.locationType = normalizeLocationType(locationType);
  if (color !== undefined) eventType.color = color;
  if (isActive !== undefined) eventType.isActive = isActive;
  if (requiresApproval !== undefined) eventType.requiresApproval = requiresApproval;
  if (bufferMinutes !== undefined) {
    eventType.bufferMinutes = Math.max(0, Number(bufferMinutes) || 0);
  }
  if (minimumNoticeMinutes !== undefined) {
    eventType.minimumNoticeMinutes = Number(minimumNoticeMinutes) || 0;
  }
  if (bookingWindowDays !== undefined) {
    eventType.bookingWindowDays = Math.max(0, Number(bookingWindowDays) || 0);
  }
  if (maxBookingsPerDay !== undefined) {
    eventType.maxBookingsPerDay = Math.max(0, Number(maxBookingsPerDay) || 0);
  }
  if (reminderMinutesBefore !== undefined) {
    eventType.reminderMinutesBefore = Number(reminderMinutesBefore) || 0;
  }
  if (reminderOffsets !== undefined) {
    eventType.reminderOffsets = Array.isArray(reminderOffsets)
      ? reminderOffsets.map(Number).filter((n) => n > 0)
      : [];
  }
  if (policyNotes !== undefined) eventType.policyNotes = policyNotes;
  if (ctaButtonText !== undefined) eventType.ctaButtonText = ctaButtonText;
  if (successTitle !== undefined) eventType.successTitle = successTitle;
  if (successMessage !== undefined) eventType.successMessage = successMessage;

  // slotIntervalMinutes：文件層 + collection $set 雙寫，避免舊 schema 吃掉欄位
  const interval =
    slotIntervalMinutes !== undefined
      ? Math.max(0, Number(slotIntervalMinutes) || 0)
      : undefined;
  if (interval !== undefined) {
    eventType.set("slotIntervalMinutes", interval);
  }

  await eventType.save();

  if (interval !== undefined) {
    await EventType.collection.updateOne(
      { _id: eventType._id },
      { $set: { slotIntervalMinutes: interval } }
    );
  }

  // 重新讀取，確認回傳值與 DB 一致
  const fresh = await EventType.findById(eventType._id).lean();

  return NextResponse.json({
    eventType: {
      ...fresh,
      id: String(fresh._id),
      slotIntervalMinutes: Number(fresh?.slotIntervalMinutes) || 0,
      bufferMinutes: Number(fresh?.bufferMinutes) || 0,
    },
  });
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

  return NextResponse.json({ ok: true });
}
