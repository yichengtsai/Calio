"use client";

import { usePathname } from "next/navigation";

/** Very short fade on route change — avoids laggy “wait for animation”. */
export default function DashboardPageShell({ children }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="calio-route-swap min-h-0 w-full">
      {children}
    </div>
  );
}
