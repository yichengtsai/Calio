import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import ClientPackage from "@/models/ClientPackage";
import EventType from "@/models/EventType";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectMongo();

  const packages = await ClientPackage.find({ organizer: session.user.id })
    .populate("eventType", "title slug duration color")
    .sort({ updatedAt: -1 })
    .lean();

  const mapped = packages.map((p) => ({
    ...p,
    id: String(p._id),
    remainingSessions: Math.max(0, (p.totalSessions || 0) - (p.usedSessions || 0)),
    eventType: p.eventType
      ? { ...p.eventType, id: String(p.eventType._id) }
      : null,
  }));

  return NextResponse.json({ packages: mapped });
}


export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const { eventTypeId, totalSessions, notes, students, inviteeEmail, inviteeName } =
    body;

  const total = Number(totalSessions);
  if (!eventTypeId || !Number.isFinite(total) || total < 1) {
    return NextResponse.json(
      { error: "eventTypeId and totalSessions (>=1) are required" },
      { status: 400 }
    );
  }

  // 支援一次多位：students: [{ email, name }]；或單筆 inviteeEmail
  let list = [];
  if (Array.isArray(students) && students.length > 0) {
    list = students
      .map((s) => ({
        email: String(s.email || s.inviteeEmail || "")
          .trim()
          .toLowerCase(),
        name: (s.name || s.inviteeName || "").trim() || undefined,
      }))
      .filter((s) => s.email);
  } else if (inviteeEmail) {
    list = [
      {
        email: String(inviteeEmail).trim().toLowerCase(),
        name: (inviteeName || "").trim() || undefined,
      },
    ];
  }

  if (list.length === 0) {
    return NextResponse.json(
      { error: "At least one student email is required" },
      { status: 400 }
    );
  }

  await connectMongo();

  const eventType = await EventType.findOne({
    _id: eventTypeId,
    user: session.user.id,
  });
  if (!eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  const created = [];
  for (const s of list) {
    const pkg = await ClientPackage.create({
      organizer: session.user.id,
      eventType: eventType._id,
      inviteeEmail: s.email,
      inviteeName: s.name,
      totalSessions: total,
      usedSessions: 0,
      status: "active",
      notes: notes || undefined,
    });
    created.push(pkg);
  }

  return NextResponse.json(
    { packages: created, package: created[0], count: created.length },
    { status: 201 }
  );
}
