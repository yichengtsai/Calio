import Link from "next/link";
import TeamEventsList from "@/components/TeamEventsList";

export default function TeamEventsPage() {
  return (
    <section className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-extrabold">Team events</h1>
          <p className="text-base-content/60">
            Events you created and invited people to directly.
          </p>
        </div>
        <Link href="/dashboard/events/new" className="btn btn-primary btn-sm shrink-0">
          + New
        </Link>
      </div>

      <TeamEventsList />
    </section>
  );
}
