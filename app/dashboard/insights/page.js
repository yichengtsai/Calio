import Link from "next/link";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { canUseInsights } from "@/libs/plans";
import InsightsView from "@/components/InsightsView";

export default async function InsightsPage() {
  await connectMongo();
  const session = await auth();
  const user = await User.findById(session.user.id);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold">Insights</h1>
        <p className="text-base-content/60 mt-1">
          How your time is actually being spent — trends, popular event types, and response
          rates.
        </p>
      </div>

      {canUseInsights(user) ? (
        <InsightsView />
      ) : (
        <div className="rounded-2xl border border-dashed border-base-300 p-10 text-center space-y-3">
          <p className="font-semibold">Insights is a Pro feature</p>
          <p className="text-sm text-base-content/60 max-w-sm mx-auto">
            See your meeting trends, which event types get booked the most, your cancellation
            rate, and more — upgrade to unlock it.
          </p>
          <Link href="/dashboard/settings" className="btn btn-primary btn-sm">
            Upgrade to Pro
          </Link>
        </div>
      )}
    </section>
  );
}
