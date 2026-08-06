import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import EventType from "@/models/EventType";

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 產生一段隨機亂碼,讓網址不能單純用活動名稱猜出來,降低被亂槍打鳥掃描/濫用的風險
function randomSuffix(length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
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
    minimumNoticeMinutes,
    reminderMinutesBefore,
    policyNotes,
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

  const baseSlug = slugify(title) || "event";
  let slug = `${baseSlug}-${randomSuffix()}`;

  // 機率極低,但還是保險檢查一次唯一性,萬一真的撞到就重抽
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
    locationType: locationType || "video",
    color: color || undefined,
    requiresApproval: requiresApproval !== undefined ? requiresApproval : true,
    bufferMinutes: Number(bufferMinutes) || 0,
    minimumNoticeMinutes: Number(minimumNoticeMinutes) || 0,
    reminderMinutesBefore:
      reminderMinutesBefore !== undefined ? Number(reminderMinutesBefore) || 0 : 30,
    policyNotes: policyNotes || undefined,
  });

  return NextResponse.json({ eventType }, { status: 201 });
}
