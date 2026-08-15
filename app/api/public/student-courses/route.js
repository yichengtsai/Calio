import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import EventType from "@/models/EventType";
import ClientPackage from "@/models/ClientPackage";
import { rateLimit, getClientIp } from "@/libs/rateLimit";

/**
 * GET /api/public/student-courses?username=&email=
 * 依 email 回傳該教練底下學員可預約的課程：
 * - 需堂數的課：有 active 方案且剩餘 > 0 才列出，並帶 remainingSessions
 * - 不需堂數的課：一律列出
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

    // eventTypeId -> { remaining, total, inviteeName, packageId }
    const packageByEventType = new Map();
    let inviteeName = null;

    for (const pkg of packages) {
      const remaining = Math.max(
        0,
        (pkg.totalSessions || 0) - (pkg.usedSessions || 0)
      );
      if (remaining <= 0) continue;

      const etId = String(pkg.eventType);
      const prev = packageByEventType.get(etId);
      if (!prev) {
        packageByEventType.set(etId, {
          remainingSessions: remaining,
          totalSessions: pkg.totalSessions || 0,
          packageId: String(pkg._id),
        });
      } else {
        // 多筆方案時加總剩餘
        prev.remainingSessions += remaining;
        prev.totalSessions += pkg.totalSessions || 0;
      }
      if (pkg.inviteeName && !inviteeName) inviteeName = pkg.inviteeName;
    }

    const courses = [];

    for (const et of eventTypes) {
      const etId = String(et._id);
      const requiresPackage = Boolean(et.requiresSessionPackage);
      const pkgInfo = packageByEventType.get(etId);

      if (requiresPackage && !pkgInfo) {
        // 需堂數但沒有剩餘 → 不顯示
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
        remainingSessions: requiresPackage
          ? pkgInfo.remainingSessions
          : null,
        totalSessions: requiresPackage ? pkgInfo.totalSessions : null,
        packageId: requiresPackage ? pkgInfo.packageId : null,
      });
    }

    return NextResponse.json({
      email,
      inviteeName,
      courses,
      hasAnyPackage: packageByEventType.size > 0,
    });
  } catch (e) {
    console.error("GET student-courses", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
