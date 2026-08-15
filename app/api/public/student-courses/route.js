import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import EventType from "@/models/EventType";
import ClientPackage from "@/models/ClientPackage";
import { getPackageAvailability } from "@/libs/sessions";
import { rateLimit, getClientIp } from "@/libs/rateLimit";

/**
 * GET /api/public/student-courses?username=&email=
 * 可用堂數 = total - used - 已預約未扣（pending/confirmed）
 */
export async function GET(req) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`student-courses:${ip}`, 30, 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const email = String(searchParams.get("email") || "")
      .trim()
      .toLowerCase();

    if (!username || !email) {
      return NextResponse.json(
        { error: "username and email are required" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    await connectMongo();

    const user = await User.findOne({ username }).select("_id name");
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const eventTypes = await EventType.find({
      user: user._id,
      isActive: true,
    })
      .sort({ createdAt: 1 })
      .lean();

    const packages = await ClientPackage.find({
      organizer: user._id,
      inviteeEmail: email,
      status: "active",
    }).lean();

    // eventTypeId -> aggregated availability
    const balanceByEventType = new Map();
    let inviteeName = null;

    for (const pkg of packages) {
      const avail = await getPackageAvailability(pkg);
      const etId = String(pkg.eventType);
      const prev = balanceByEventType.get(etId) || {
        remainingSessions: 0,
        totalSessions: 0,
        usedSessions: 0,
        reservedSessions: 0,
        packageId: null,
      };
      prev.remainingSessions += avail.remainingSessions;
      prev.totalSessions += avail.totalSessions;
      prev.usedSessions += avail.usedSessions;
      prev.reservedSessions += avail.reservedSessions;
      if (avail.remainingSessions > 0 && !prev.packageId) {
        prev.packageId = String(pkg._id);
      }
      balanceByEventType.set(etId, prev);
      if (pkg.inviteeName && !inviteeName) inviteeName = pkg.inviteeName;
    }

    const courses = [];

    for (const et of eventTypes) {
      const etId = String(et._id);
      const requiresPackage = Boolean(et.requiresSessionPackage);
      const bal = balanceByEventType.get(etId);

      if (requiresPackage && !(bal && bal.remainingSessions > 0)) {
        continue;
      }

      courses.push({
        slug: et.slug,
        title: et.title,
        description: et.description || "",
        duration: et.duration,
        location: et.location || "",
        locationType: et.locationType || "custom",
        color: et.color || "#6366f1",
        requiresSessionPackage: requiresPackage,
        price: et.price != null ? Number(et.price) : null,
        currency: et.currency || "TWD",
        remainingSessions: requiresPackage ? bal.remainingSessions : null,
        totalSessions: requiresPackage ? bal.totalSessions : null,
        usedSessions: requiresPackage ? bal.usedSessions : null,
        reservedSessions: requiresPackage ? bal.reservedSessions : null,
        packageId: requiresPackage ? bal.packageId : null,
      });
    }

    return NextResponse.json({
      email,
      inviteeName,
      courses,
      hasAnyPackage: balanceByEventType.size > 0,
    });
  } catch (e) {
    console.error("GET student-courses", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
