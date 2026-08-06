import BookingsList from "@/components/BookingsList";

export default function BookingsPage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold">Bookings</h1>
        <p className="text-base-content/60">
          Everyone who has booked time with you through your booking page.
        </p>
      </div>

      <BookingsList />
    </section>
  );
}
