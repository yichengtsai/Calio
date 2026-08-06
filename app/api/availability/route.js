import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Availability from "@/models/Availability";
import User from "@/models/User";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// 沒設定過的使用者,預設建議週一到週五 9:00-17:00(前端顯示用,還沒真的存進資料庫)
const DEFAULT_SLOTS = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: "09:00",
  endTime: "17:00",
}));

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectMongo();

  const [user, availability] = await Promise.all([
    User.findById(session.user.id),
    Availability.findOne({ user: session.user.id }),
  ]);

  return NextResponse.json({
    timezone: user?.timezone || "Asia/Taipei",
    timeSlots: availability?.timeSlots?.length ? availability.timeSlots : DEFAULT_SLOTS,
    hasSavedAvailability: Boolean(availability),
  });
}

export async function PUT(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const { timezone, timeSlots } = body;

  if (!Array.isArray(timeSlots)) {
    return NextResponse.json({ error: "timeSlots must be an array" }, { status: 400 });
  }

  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

  for (const slot of timeSlots) {
    if (
      typeof slot.dayOfWeek !== "number" ||
      slot.dayOfWeek < 0 ||
      slot.dayOfWeek > 6 ||
      !timePattern.test(slot.startTime) ||
      !timePattern.test(slot.endTime)
    ) {
      return NextResponse.json(
        { error: `Invalid time slot for ${DAY_NAMES[slot.dayOfWeek] || "unknown day"}` },
        { status: 400 }
      );
    }
    if (slot.startTime >= slot.endTime) {
      return NextResponse.json(
        { error: `End time must be after start time on ${DAY_NAMES[slot.dayOfWeek]}` },
        { status: 400 }
      );
    }
  }

  await connectMongo();

  await User.findByIdAndUpdate(session.user.id, {
    timezone: timezone || "Asia/Taipei",
  });

  const availability = await Availability.findOneAndUpdate(
    { user: session.user.id },
    { user: session.user.id, timeSlots },
    { upsert: true, new: true }
  );

  return NextResponse.json({ availability });
}
