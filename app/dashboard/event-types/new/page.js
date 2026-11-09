import EventTypeForm from "@/components/EventTypeForm";
import DashboardPageWash from "@/components/DashboardPageWash";

export default function NewEventTypePage() {
  return (
    <DashboardPageWash tone="sky" className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">New event type</h1>
        <p className="text-sm text-base-content/55 mt-1">
          What guests can book on your page.
        </p>
      </div>
      <EventTypeForm />
    </DashboardPageWash>
  );
}
