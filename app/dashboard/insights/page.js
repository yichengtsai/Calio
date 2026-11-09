import Link from "next/link";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { canUseInsights } from "@/libs/plans";
import InsightsView from "@/components/InsightsView";
import DashboardPageWash from "@/components/DashboardPageWash";

export default async function InsightsPage() {
  await connectMongo();
  const session = await auth();
  const user = await User.findById(session.user.id);

  return (
    <DashboardPageWash tone="sky" className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-base-content/55 mt-1">
          Booking trends and how your time is used.
        </p>
      </div>

      {canUseInsights(user) ? (
        <InsightsView />
      ) : (
        <div className="rounded-2xl border border-dashed border-base-300 p-10 text-center space-y-3 bg-base-100/50">
          <p className="font-semibold">Insights is a Pro feature</p>
          <p className="text-sm text-base-content/60 max-w-sm mx-auto">
            Meeting trends, popular event types, and more.
          </p>
          <Link href="/dashboard/settings" className="btn btn-primary btn-sm">
            Upgrade to Pro
          </Link>
        </div>
      )}
    </DashboardPageWash>
  );
}
