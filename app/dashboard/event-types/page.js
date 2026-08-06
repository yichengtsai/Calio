import Link from "next/link";
import EventTypeList from "@/components/EventTypeList";

export default function EventTypesPage() {
  return (
    <section className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-extrabold">Event types</h1>
          <p className="text-base-content/60">
            These show up on your booking page for people to choose from.
          </p>
        </div>
        <Link href="/dashboard/event-types/new" className="btn btn-primary btn-sm shrink-0">
          + New
        </Link>
      </div>

      <EventTypeList />
    </section>
  );
}
