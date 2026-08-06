import EventTypeForm from "@/components/EventTypeForm";

export default async function EditEventTypePage({ params }) {
  const { id } = await params;

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold">Edit event type</h1>
        <p className="text-base-content/60">
          Changes apply immediately — existing bookings aren&apos;t affected.
        </p>
      </div>

      <EventTypeForm eventTypeId={id} />
    </section>
  );
}
