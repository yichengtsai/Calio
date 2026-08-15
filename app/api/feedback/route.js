import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Feedback from "@/models/Feedback";
import Booking from "@/models/Booking";
import ClientPackage from "@/models/ClientPackage";
import EventType from "@/models/EventType";
import User from "@/models/User";
import { isPlatformAdmin } from "@/libs/admin";

/**
 * Platform owner only: all product feedback + site-wide usage.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isPlatformAdmin(session)) {
    return NextResponse.json(
      { error: "Platform admin only. Set ADMIN_EMAILS to your login email." },
      { status: 403 }
    );
  }

  await connectMongo();

  const [
    feedback,
    coachCount,
    coachesWithUsername,
    bookingCount,
    confirmedCount,
    packageCount,
    eventTypeCount,
    distinctClients,
  ] = await Promise.all([
    Feedback.find({}).sort({ createdAt: -1 }).limit(200).lean(),
    User.countDocuments({}),
    User.countDocuments({ username: { $exists: true, $nin: [null, ""] } }),
    Booking.countDocuments({}),
    Booking.countDocuments({ status: "confirmed" }),
    ClientPackage.countDocuments({}),
    EventType.countDocuments({ isActive: true }),
    Booking.distinct("inviteeEmail"),
  ]);

  const newCount = feedback.filter((f) => f.status === "new").length;

  return NextResponse.json({
    feedback: feedback.map((f) => ({
      ...f,
      id: String(f._id),
    })),
    usage: {
      // Site-wide (whole Calio product)
      registeredCoaches: coachCount,
      coachesWithBookingPage: coachesWithUsername,
      totalBookings: bookingCount,
      confirmedBookings: confirmedCount,
      uniqueClients: distinctClients.length,
      sessionPackages: packageCount,
      activeEventTypes: eventTypeCount,
      feedbackTotal: feedback.length,
      feedbackNew: newCount,
    },
  });
}

export async function PATCH(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isPlatformAdmin(session)) {
    return NextResponse.json({ error: "Platform admin only" }, { status: 403 });
  }

  const body = await req.json();
  const id = body.id;
  const status = body.status;
  if (!id || !["new", "read", "archived"].includes(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await connectMongo();
  const updated = await Feedback.findOneAndUpdate(
    { _id: id },
    { status },
    { new: true }
  ).lean();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    feedback: { ...updated, id: String(updated._id) },
  });
}
