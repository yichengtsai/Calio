export default function DashboardLoading() {
  return (
    <section className="space-y-8 max-w-3xl animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-48 md:w-64 rounded-lg bg-base-200" />
        <div className="h-4 w-72 max-w-full rounded bg-base-200" />
      </div>
      <div className="flex gap-2 border-b border-base-300 pb-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-20 rounded-md bg-base-200" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-base-200" />
        ))}
      </div>
    </section>
  );
}
