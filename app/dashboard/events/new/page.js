import { getSEOTags } from "@/libs/seo";
import CreateEventForm from "@/components/CreateEventForm";

export const metadata = getSEOTags({ canonicalUrlRelative: "/events/new" });

export default function NewEventPage() {
  return (
    <section className="max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold">Create a new event</h1>
        <p className="text-base-content/60">
          Fill in the details below — invites go out automatically once you submit.
        </p>
      </div>

      <CreateEventForm />
    </section>
  );
}
