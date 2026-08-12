import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/libs/auth";
import config from "@/config";
import ButtonAccount from "@/components/ButtonAccount";
import DashboardNav from "@/components/DashboardNav";

export default async function LayoutPrivate({ children }) {
  const session = await auth();

  if (!session) {
    redirect(config.auth.loginUrl);
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-base-300 bg-base-200 flex flex-col">
        <div className="px-5 py-5 border-b border-base-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={config.appName} className="h-10 w-auto" />
        </div>

        <Suspense fallback={<div className="flex-1 px-3 py-4" />}>
          <DashboardNav />
        </Suspense>

        <div className="px-3 py-4 border-t border-base-300">
          <ButtonAccount />
        </div>
      </aside>

      <main className="flex-1 p-8 md:p-10">{children}</main>
    </div>
  );
}
