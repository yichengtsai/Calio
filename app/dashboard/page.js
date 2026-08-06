import Link from "next/link";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import Booking from "@/models/Booking";
import Event from "@/models/Event";
import Block from "@/models/Block";
import { zonedTimeToUtc } from "@/libs/timezone";
import TodayScheduleList from "@/components/TodayScheduleList";

function dateStrInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = {};
  parts.forEach((p) => (map[p.type] = p.value));
  return `${map.year}-${map.month}-${map.day}`;
}

const HOW_IT_WORKS = [
  {
    step: "1",
    name: "Set your availability",
    href: "/dashboard/availability",
    description:
      "Go to Availability, toggle on the days you're open, and set a time range for each. This decides which hours people can even see as options.",
  },
  {
    step: "2",
    name: "Create an event type",
    href: "/dashboard/event-types",
    description:
      "Go to Event Types → \"+ New\". Give it a name, a duration, and choose whether bookings need your approval or confirm instantly.",
  },
  {
    step: "3",
    name: "Share your booking page",
    href: "/dashboard/settings",
    description:
      "In Settings, pick a username. That gives you a link like yoursite.com/you — send that to anyone you want to book time with you.",
  },
  {
    step: "4",
    name: "Review requests as they come in",
    href: "/dashboard/bookings",
    description:
      "New requests land in Bookings → Pending. Approve or decline each one — approving sends a confirmation, declining lets them know politely.",
  },
  {
    step: "5",
    name: "See everything in one place",
    href: "/dashboard/calendar",
    description:
      "Calendar shows bookings, events you've created, and personal time blocks together. Click anything on it for details.",
  },
  {
    step: "6",
    name: "Add your own meetings too",
    href: "/dashboard/events",
    description:
      "Team Events is for when you want to set up a meeting yourself and invite people directly by email, instead of waiting for them to book.",
  },
];

export default async function Dashboard() {
  await connectMongo();
  const session = await auth();
  const user = await User.findById(session.user.id);

  const timezone = user?.timezone || "Asia/Taipei";
  const todayStr = dateStrInTimezone(new Date(), timezone);
  const todayStart = zonedTimeToUtc(todayStr, "00:00", timezone);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterStart = new Date(todayStart.getTime() + 48 * 60 * 60 * 1000);

  const [bookings, events, blocks] = await Promise.all([
    Booking.find({
      organizer: session.user.id,
      status: "confirmed",
      startTime: { $lt: dayAfterStart },
      endTime: { $gt: todayStart },
    }).populate("eventType", "title color location"),
    Event.find({
      organizer: session.user.id,
      status: { $ne: "cancelled" },
      startTime: { $lt: dayAfterStart },
      endTime: { $gt: todayStart },
    }),
    Block.find({
      user: session.user.id,
      startTime: { $lt: dayAfterStart },
      endTime: { $gt: todayStart },
    }),
  ]);

  const items = [
    ...bookings.map((b) => ({
      id: b.id,
      source: "booking",
      title: b.eventType?.title || "Booking",
      subtitle: b.inviteeName,
      startTime: b.startTime,
      color: b.eventType?.color || "#6366f1",
      location: b.eventType?.location || null,
      inviteeName: b.inviteeName,
      inviteeEmail: b.inviteeEmail,
      inviteeNotes: b.inviteeNotes || null,
    })),
    ...events.map((e) => ({
      id: e.id,
      source: "event",
      title: e.title,
      subtitle: e.participants?.length
        ? `${e.participants.length} participant${e.participants.length === 1 ? "" : "s"}`
        : null,
      startTime: e.startTime,
      color: e.color || "#0ea5e9",
      location: e.location || null,
      description: e.description || null,
      participants: (e.participants || []).map((p) => ({
        name: p.name || null,
        email: p.email,
      })),
    })),
    ...blocks.map((b) => ({
      id: b.id,
      source: "block",
      title: b.title || "Busy",
      subtitle: null,
      startTime: b.startTime,
      color: b.color || "#6b7280",
      location: null,
      notes: b.notes || null,
    })),
  ].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const todayItems = items.filter((i) => new Date(i.startTime) < tomorrowStart);
  const tomorrowItems = items.filter((i) => new Date(i.startTime) >= tomorrowStart);
  const hasSchedule = items.length > 0;

  return (
    <section className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold">
          Welcome back, {user?.name || "there"} 👋
        </h1>
        <p className="text-base-content/60 mt-1">
          {hasSchedule
            ? "Here's what's coming up."
            : "Here's where everything lives and what it's for."}
        </p>
      </div>

      {!user?.username && (
        <div className="card bg-primary/10 border border-primary/30">
          <div className="card-body">
            <h2 className="card-title text-base">Set up your booking page</h2>
            <p className="text-base-content/60 text-sm">
              Choose a username to get your public link and start accepting bookings.
            </p>
            <div className="card-actions mt-2">
              <Link href="/dashboard/settings" className="btn btn-primary btn-sm">
                Go to settings
              </Link>
            </div>
          </div>
        </div>
      )}

      {hasSchedule ? (
        <TodayScheduleList
          groups={[
            { label: "Today", items: todayItems },
            { label: "Tomorrow", items: tomorrowItems },
          ]}
          timezone={timezone}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-base-300 p-8 text-center space-y-3">
          <p className="font-semibold">Nothing on your plate today or tomorrow</p>
          <p className="text-sm text-base-content/60 max-w-sm mx-auto">
            Set up an event type so people can book time with you, or share your booking page
            to start filling up your calendar.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Link href="/dashboard/event-types/new" className="btn btn-primary btn-sm">
              Create an event type
            </Link>
            {user?.username && (
              <Link href={`/${user.username}`} target="_blank" className="btn btn-outline btn-sm">
                View booking page
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 不用截圖,直接用步驟卡片說明怎麼操作 */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-base-content/40">
          How it works
        </p>
        <div className="space-y-2.5">
          {HOW_IT_WORKS.map((step) => (
            <Link
              key={step.step}
              href={step.href}
              className="group flex items-start gap-4 rounded-xl border border-base-300 bg-base-200 px-5 py-4 transition-colors hover:border-primary/50"
            >
              <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step.step}
              </span>
              <div>
                <p className="font-semibold text-sm">{step.name}</p>
                <p className="text-sm text-base-content/60 mt-0.5 leading-relaxed">
                  {step.description}
                </p>
              </div>
              <span className="text-base-content/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-auto">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
