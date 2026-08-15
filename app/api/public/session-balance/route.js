import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import EventType from "@/models/EventType";
import { getStudentCourseBalance } from "@/libs/sessions";
import { rateLimit, getClientIp } from "@/libs/rateLimit";

export async function GET(req) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`session-balance:${ip}`, 30, 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const slug = searchParams.get("slug");
    const email = String(searchParams.get("email") || "")
      .trim()
      .toLowerCase();

    if (!username || !slug || !email) {
      return NextResponse.json(
        { error: "username, slug, and email are required" },
        { status: 400 }
      );
    }

    await connectMongo();

    const user = await User.findOne({ username }).select("_id");
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const eventType = await EventType.findOne({
      user: user._id,
      slug,
      isActive: true,
    }).select("title requiresSessionPackage");

    if (!eventType) {
      return NextResponse.json({ error: "Event type not found" }, { status: 404 });
    }

    if (!eventType.requiresSessionPackage) {
      return NextResponse.json({
        requiresSessionPackage: false,
        remainingSessions: null,
        reservedSessions: null,
      });
    }

    const bal = await getStudentCourseBalance({
      organizerId: user._id,
      eventTypeId: eventType._id,
      inviteeEmail: email,
    });

    return NextResponse.json({
      requiresSessionPackage: true,
      remainingSessions: bal.remainingSessions,
      totalSessions: bal.totalSessions,
      usedSessions: bal.usedSessions,
      reservedSessions: bal.reservedSessions,
      hasPackage: bal.hasPackage,
      inviteeName: bal.inviteeName,
      packageId: bal.packageId,
    });
  } catch (e) {
    console.error("GET session-balance", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
