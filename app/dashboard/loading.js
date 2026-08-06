export default function DashboardLoading() {
  return (
    <section className="space-y-8 max-w-2xl">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-lg bg-base-200 animate-pulse" />
        <div className="h-4 w-48 rounded bg-base-200 animate-pulse" />
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-base-200 animate-pulse" />
        ))}
      </div>
    </section>
  );
}
