import CreateEventForm from "@/components/CreateEventForm";

export default async function EditEventPage({ params }) {
  const { id } = await params;

  return (
    <section className="max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold">Edit event</h1>
        <p className="text-base-content/60">
          Update the details below. The guest list can&apos;t be changed here.
        </p>
      </div>

      <CreateEventForm eventId={id} />
    </section>
  );
}
