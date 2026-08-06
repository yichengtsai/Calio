import AvailabilityForm from "@/components/AvailabilityForm";

export default function AvailabilityPage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold">Availability</h1>
        <p className="text-base-content/60">
          Set the hours you&apos;re open for bookings. People booking your page will only see slots inside these windows.
        </p>
      </div>

      <AvailabilityForm />
    </section>
  );
}
