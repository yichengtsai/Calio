import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/libs/auth";
import config from "@/config";
import ButtonAccount from "@/components/ButtonAccount";
import DashboardNav from "@/components/DashboardNav";
import ProductTourHost from "@/components/ProductTourHost";

export default async function LayoutPrivate({ children }) {
  const session = await auth();

  if (!session) {
    redirect(config.auth.loginUrl);
  }

  return (
    <div className="min-h-screen flex bg-base-100">
      <aside className="w-56 shrink-0 border-r border-base-300/80 bg-base-200/60 flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-base-300/80 space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={config.appName} className="h-9 w-auto" />
          <div className="flex items-center">
            <ButtonAccount />
          </div>
        </div>

        <Suspense fallback={<div className="flex-1 px-2 py-3" />}>
          <DashboardNav />
        </Suspense>
      </aside>

      {/* No animation on main shell — page content animates via template + PageShell */}
      <main className="flex-1 min-w-0 p-6 md:p-8 lg:p-10 overflow-x-hidden">
        {children}
      </main>

      <ProductTourHost autoStart={false} />
    </div>
  );
}
