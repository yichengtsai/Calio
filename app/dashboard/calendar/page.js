import CalendarView from "@/components/CalendarView";

export default function CalendarPage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold">My Calendar</h1>
        <p className="text-base-content/60">
          A weekly view of everything on your schedule.
        </p>
      </div>

      <CalendarView />
    </section>
  );
}
