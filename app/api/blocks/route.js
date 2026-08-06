import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Block from "@/models/Block";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectMongo();

  const blocks = await Block.find({ user: session.user.id }).sort({ startTime: 1 });

  return NextResponse.json({ blocks });
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const { title, notes, startTime, endTime, color } = body;

  if (!startTime || !endTime) {
    return NextResponse.json(
      { error: "Start time and end time are required" },
      { status: 400 }
    );
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 }
    );
  }

  await connectMongo();

  const block = await Block.create({
    user: session.user.id,
    title: title?.trim() || "Busy",
    notes: notes || undefined,
    startTime: start,
    endTime: end,
    color: color || undefined,
  });

  return NextResponse.json({ block }, { status: 201 });
}
