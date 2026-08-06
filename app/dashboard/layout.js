import { redirect } from "next/navigation";
import { auth } from "@/libs/auth";
import config from "@/config";
import ButtonAccount from "@/components/ButtonAccount";
import DashboardNav from "@/components/DashboardNav";

// This is a server-side component to ensure the user is logged in.
// If not, it will redirect to the login page.
// It's applied to all subpages of /dashboard in /app/dashboard/*** pages
export default async function LayoutPrivate({ children }) {
  const session = await auth();

  if (!session) {
    redirect(config.auth.loginUrl);
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-base-300 bg-base-200 flex flex-col">
        <div className="px-5 py-5 border-b border-base-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={config.appName} className="h-10 w-auto" />
        </div>

        <DashboardNav />

        <div className="px-3 py-4 border-t border-base-300">
          <ButtonAccount />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 md:p-10">{children}</main>
    </div>
  );
}
