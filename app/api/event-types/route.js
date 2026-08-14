import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import EventType from "@/models/EventType";
import User from "@/models/User";
import { canCreateEventType, FREE_EVENT_TYPE_LIMIT } from "@/libs/plans";

const LOCATION_TYPES = ["google_meet", "in_person", "phone", "custom"];

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomSuffix(length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function normalizeLocationType(value) {
  if (!value) return "custom";
  if (value === "video") return "google_meet";
  if (LOCATION_TYPES.includes(value)) return value;
  return "custom";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectMongo();

  const eventTypes = await EventType.find({ user: session.user.id }).sort({
    createdAt: -1,
  });

  return NextResponse.json({ eventTypes });
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const {
    title,
    description,
    duration,
    location,
    locationType,
    color,
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

  if (!title || !duration) {
    return NextResponse.json(
      { error: "Title and duration are required" },
      { status: 400 }
    );
  }

  if (title.length > 200) {
    return NextResponse.json(
      { error: "Title must be 200 characters or fewer" },
      { status: 400 }
    );
  }

  const durationNum = Number(duration);
  if (!Number.isFinite(durationNum) || durationNum < 5) {
    return NextResponse.json(
      { error: "Duration must be at least 5 minutes" },
      { status: 400 }
    );
  }

  await connectMongo();

  const [user, existingCount] = await Promise.all([
    User.findById(session.user.id),
    EventType.countDocuments({ user: session.user.id }),
  ]);

  if (!canCreateEventType(user, existingCount)) {
    return NextResponse.json(
      {
        error: `The Free plan is limited to ${FREE_EVENT_TYPE_LIMIT} event type. Upgrade to Pro for unlimited event types.`,
        code: "event_type_limit_reached",
      },
      { status: 403 }
    );
  }

  const baseSlug = slugify(title) || "event";
  let slug = `${baseSlug}-${randomSuffix()}`;

  while (await EventType.exists({ user: session.user.id, slug })) {
    slug = `${baseSlug}-${randomSuffix()}`;
  }

  const eventType = await EventType.create({
    user: session.user.id,
    title,
    slug,
    description: description || undefined,
    duration: durationNum,
    location: location || undefined,
    locationType: normalizeLocationType(locationType),
    color: color || undefined,
    requiresApproval: requiresApproval !== undefined ? requiresApproval : true,
    bufferMinutes: Number(bufferMinutes) || 0,
    slotIntervalMinutes: Number(slotIntervalMinutes) || 0,
    minimumNoticeMinutes: Number(minimumNoticeMinutes) || 0,
    bookingWindowDays:
      bookingWindowDays !== undefined ? Math.max(0, Number(bookingWindowDays) || 0) : 60,
    maxBookingsPerDay: Number(maxBookingsPerDay) || 0,
    reminderMinutesBefore:
      reminderMinutesBefore !== undefined ? Number(reminderMinutesBefore) || 0 : 30,
    reminderOffsets: Array.isArray(reminderOffsets)
      ? reminderOffsets.map(Number).filter((n) => n > 0)
      : undefined,
    policyNotes: policyNotes || undefined,
    ctaButtonText: ctaButtonText || undefined,
    successTitle: successTitle || undefined,
    successMessage: successMessage || undefined,
  });

  await EventType.collection.updateOne(
    { _id: eventType._id },
    { $set: { slotIntervalMinutes: Math.max(0, Number(slotIntervalMinutes) || 0) } }
  );

  return NextResponse.json({ eventType }, { status: 201 });
}
