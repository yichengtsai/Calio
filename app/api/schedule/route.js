import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";
import Event from "@/models/Event";
import Block from "@/models/Block";
import User from "@/models/User";
import "@/models/EventType";
import { listGoogleCalendarEvents } from "@/libs/googleCalendar";
import { canUseGoogleCalendarSync } from "@/libs/plans";

const GOOGLE_PULL_WINDOW_PAST_DAYS = Number(process.env.GOOGLE_PULL_WINDOW_PAST_DAYS) || 7;
const GOOGLE_PULL_WINDOW_FUTURE_DAYS = Number(process.env.GOOGLE_PULL_WINDOW_FUTURE_DAYS) || 90;

function mapLocalItems(bookings, events, blocks) {
  return [
    ...bookings.map((b) => ({
      id: b._id.toString(),
      source: "booking",
      status: b.status,
      title: b.eventType?.title || "Booking",
      subtitle: b.inviteeName,
      startTime: b.startTime,
      endTime: b.endTime,
      color: b.eventType?.color || "#6366f1",
      location:
        b.eventType?.locationType === "google_meet"
          ? "Google Meet"
          : b.eventType?.location || null,
      meetingUrl: b.meetingUrl || null,
      inviteeName: b.inviteeName,
      inviteeEmail: b.inviteeEmail,
      inviteeNotes: b.inviteeNotes || null,
      googleEventId: b.googleEventId || null,
    })),
    ...events.map((e) => ({
      id: e._id.toString(),
      source: "event",
      status: "confirmed",
      title: e.title,
      subtitle: e.participants?.length
        ? `${e.participants.length} participant${e.participants.length === 1 ? "" : "s"}`
        : null,
      startTime: e.startTime,
      endTime: e.endTime,
      color: e.color || "#0ea5e9",
      location: e.location || null,
      meetingUrl: e.meetingUrl || null,
      description: e.description || null,
      participants: (e.participants || []).map((p) => ({
        name: p.name || null,
        email: p.email,
        status: p.status,
      })),
      googleEventId: e.googleEventId || null,
    })),
    ...blocks.map((b) => ({
      id: b._id.toString(),
      source: "block",
      status: "confirmed",
      title: b.title || "Busy",
      subtitle: null,
      startTime: b.startTime,
      endTime: b.endTime,
      color: b.color || "#6b7280",
      location: null,
      notes: b.notes || null,
    })),
  ];
}

function mapGoogleOnly(googleOnlyEvents) {
  return googleOnlyEvents.map((e) => ({
    id: `google_${e.googleEventId}`,
    source: "google",
    status: "confirmed",
    title: e.title,
    subtitle: "From Google Calendar",
    startTime: e.startTime,
    endTime: e.endTime,
    color: "#34a853",
    location: e.location,
    notes: null,
  }));
}

/**
 * GET /api/schedule
 * ?local=1  — Mongo only (fast first paint)
 * default   — Mongo + Google Calendar events
 */
export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const localOnly = searchParams.get("local") === "1";

  await connectMongo();

  const [user, bookings, events, blocks] = await Promise.all([
    User.findById(session.user.id).select("hasAccess").lean(),
    Booking.find({
      organizer: session.user.id,
      status: { $in: ["confirmed", "pending"] },
    })
      .populate("eventType", "title color location locationType")
      .lean(),
    Event.find({ organizer: session.user.id, status: { $ne: "cancelled" } }).lean(),
    Block.find({ user: session.user.id }).lean(),
  ]);

  const localItems = mapLocalItems(bookings, events, blocks);

  if (localOnly) {
    return NextResponse.json({ items: localItems, phase: "local" });
  }

  let googleOnlyEvents = [];
  if (canUseGoogleCalendarSync(user)) {
    try {
      const now = new Date();
      const timeMin = new Date(now);
      timeMin.setDate(timeMin.getDate() - GOOGLE_PULL_WINDOW_PAST_DAYS);
      const timeMax = new Date(now);
      timeMax.setDate(timeMax.getDate() + GOOGLE_PULL_WINDOW_FUTURE_DAYS);

      const knownGoogleEventIds = new Set(
        [...bookings, ...events].map((item) => item.googleEventId).filter(Boolean)
      );
      const knownLocalStartTimes = new Set(
        [...bookings, ...events].map((item) => new Date(item.startTime).toISOString())
      );

      const googleEvents = await listGoogleCalendarEvents(
        session.user.id,
        timeMin,
        timeMax
      );
      googleOnlyEvents = googleEvents.filter(
        (e) =>
          !knownGoogleEventIds.has(e.googleEventId) &&
          !knownLocalStartTimes.has(e.startTime.toISOString())
      );
    } catch (err) {
      console.error("Google calendar pull failed:", err?.message || err);
      // still return local items
    }
  }

  return NextResponse.json({
    items: [...localItems, ...mapGoogleOnly(googleOnlyEvents)],
    phase: "full",
  });
}
