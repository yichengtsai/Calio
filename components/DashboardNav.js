"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const SECTIONS = [
  {
    label: "Main",
    items: [
      { name: "Calendar", href: "/dashboard", match: (p, tab) => p === "/dashboard" },
      { name: "Insights", href: "/dashboard/insights" },
    ],
  },
  {
    label: "Other",
    items: [
      { name: "Guide", href: "/dashboard/guide" },
      { name: "Settings", href: "/dashboard/settings" },
    ],
  },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingCount, setPendingCount] = useState(0);
  const fetchedOnce = useRef(false);

  function loadPendingCount() {
    fetch("/api/bookings/pending-count")
      .then((res) => res.json())
      .then((data) => setPendingCount(data.count || 0))
      .catch(() => {});
  }

  useEffect(() => {
    // 只在第一次掛載時抓，不要每次切 pathname 都打完整 bookings
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    loadPendingCount();
  }, []);

  // 從其他分頁回來時刷新 badge（visibility）
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") loadPendingCount();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return (
    <nav className="flex-1 px-3 py-4 space-y-5">
      {SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-base-content/35">
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = item.match
                ? item.match(pathname, searchParams.get("tab"))
                : pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={`relative flex items-center justify-between pl-3 pr-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-base-content/70 hover:bg-base-300 hover:text-base-content"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
                  )}
                  <span>{item.name}</span>
                  {item.name === "Calendar" && pendingCount > 0 && (
                    <span className="badge badge-warning badge-sm text-[10px] font-bold">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
