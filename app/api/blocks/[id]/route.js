import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Block from "@/models/Block";

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { title, notes, startTime, endTime, color } = body;

  await connectMongo();

  const block = await Block.findOne({ _id: id, user: session.user.id });
  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  if (title !== undefined) block.title = title?.trim() || "Busy";
  if (notes !== undefined) block.notes = notes || undefined;
  if (color !== undefined) block.color = color || undefined;

  if (startTime !== undefined || endTime !== undefined) {
    const start = startTime !== undefined ? new Date(startTime) : block.startTime;
    const end = endTime !== undefined ? new Date(endTime) : block.endTime;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }
    block.startTime = start;
    block.endTime = end;
  }

  await block.save();
  return NextResponse.json({ block });
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;

  await connectMongo();

  const block = await Block.findOneAndDelete({ _id: id, user: session.user.id });
  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
