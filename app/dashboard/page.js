import { Suspense } from "react";
import DashboardHub from "@/components/DashboardHub";

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-40 bg-base-200 rounded animate-pulse" />
          <div className="h-64 bg-base-200 rounded-2xl animate-pulse" />
        </div>
      }
    >
      <DashboardHub />
    </Suspense>
  );
}
