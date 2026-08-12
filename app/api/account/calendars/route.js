import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { listGoogleCalendars, isGoogleCalendarConnected } from "@/libs/googleCalendar";
import { canUseGoogleCalendarSync } from "@/libs/plans";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectMongo();
  const user = await User.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const connected = await isGoogleCalendarConnected(session.user.id);
  if (!connected) {
    return NextResponse.json({
      connected: false,
      syncActive: false,
      calendars: [],
      selectedIds: [],
    });
  }

  const listed = await listGoogleCalendars(session.user.id);
  const calendars = listed.calendars || [];
  const selectedIds =
    user.googleCalendarIds?.length > 0
      ? user.googleCalendarIds
      : calendars.filter((c) => c.primary).map((c) => c.id);

  return NextResponse.json({
    connected: true,
    syncActive: canUseGoogleCalendarSync(user),
    calendars,
    selectedIds,
    listError: listed.error || null,
    listErrorMessage: listed.errorMessage || null,
  });
}

export async function PATCH(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const { calendarIds } = body;

  if (!Array.isArray(calendarIds) || calendarIds.some((id) => typeof id !== "string")) {
    return NextResponse.json(
      { error: "calendarIds must be an array of strings" },
      { status: 400 }
    );
  }

  const cleaned = [...new Set(calendarIds.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    20
  );

  await connectMongo();
  const user = await User.findByIdAndUpdate(
    session.user.id,
    { googleCalendarIds: cleaned },
    { new: true }
  );

  return NextResponse.json({
    selectedIds: user.googleCalendarIds || [],
  });
}
