import CalendarView from "@/components/CalendarView";

export default function Dashboard() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold">Calendar</h1>
        <p className="text-base-content/60 mt-1">
          Everything on your schedule — bookings, your own events, and synced Google Calendar.
        </p>
      </div>

      <CalendarView />
    </section>
  );
}
