import EventTypeForm from "@/components/EventTypeForm";

export default function NewEventTypePage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold">New event type</h1>
        <p className="text-base-content/60">
          This is what people will see and pick when booking time with you.
        </p>
      </div>

      <EventTypeForm />
    </section>
  );
}
