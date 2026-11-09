"use client";

import { useEffect, useState, useRef, useMemo, useCallback, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { startProductTour } from "@/components/ProductTourHost";

const SECTIONS = [
  {
    label: "Workspace",
    items: [
      {
        name: "Calendar",
        href: "/dashboard",
        match: (p) => p === "/dashboard",
        tourId: "nav-calendar",
      },
      { name: "Packages", href: "/dashboard/packages", tourId: "packages" },
      { name: "Insights", href: "/dashboard/insights", tourId: "insights" },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Settings", href: "/dashboard/settings", tourId: "settings" },
      { name: "Platform", href: "/dashboard/feedback", adminOnly: true },
    ],
  },
];

const PLATFORM_ADMIN_EMAILS = ["yichengcai509@gmail.com"];

const ALL_HREFS = [
  "/dashboard",
  "/dashboard/packages",
  "/dashboard/insights",
  "/dashboard/settings",
  "/dashboard/feedback",
];

export default function DashboardNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [, startTransition] = useTransition();
  // Optimistic highlight so the bar reacts before the next page finishes loading
  const [optimisticPath, setOptimisticPath] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const fetchedOnce = useRef(false);
  const prefetched = useRef(false);

  const isPlatformAdmin = PLATFORM_ADMIN_EMAILS.some(
    (e) => e.toLowerCase() === (session?.user?.email || "").toLowerCase()
  );

  const visibleSections = useMemo(() => {
    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.adminOnly) return isPlatformAdmin;
        return true;
      }),
    })).filter((section) => section.items.length > 0);
  }, [isPlatformAdmin]);

  // When real route catches up, clear optimistic path
  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  function loadPendingCount() {
    fetch("/api/bookings/pending-count")
      .then((res) => res.json())
      .then((data) => setPendingCount(data.count || 0))
      .catch(() => {});
  }

  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    loadPendingCount();
  }, []);

  // Prefetch every main dashboard route once nav mounts
  useEffect(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    ALL_HREFS.forEach((href) => {
      try {
        router.prefetch(href);
      } catch {
        /* ignore */
      }
    });
  }, [router]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") loadPendingCount();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const onNavClick = useCallback(
    (href) => (e) => {
      // Keep default Link behavior but mark optimistic active immediately
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      setOptimisticPath(href);
      startTransition(() => {
        router.push(href);
      });
      // Prevent double navigation from <Link> default if we already push
      // Actually Link will also navigate — avoid double by preventing default when we push
      e.preventDefault();
    },
    [router]
  );

  const displayPath = optimisticPath || pathname;

  return (
    <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
      {visibleSections.map((section) => (
        <div key={section.label}>
          <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/30">
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = item.match
                ? item.match(displayPath, searchParams.get("tab"))
                : displayPath === item.href ||
                  displayPath.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onMouseEnter={() => router.prefetch(item.href)}
                  onFocus={() => router.prefetch(item.href)}
                  onTouchStart={() => router.prefetch(item.href)}
                  onClick={onNavClick(item.href)}
                  data-tour={item.tourId || undefined}
                  className={`relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors duration-100 ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-base-content/65 hover:bg-base-300/70 hover:text-base-content font-medium"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />
                  )}
                  <span className="truncate">{item.name}</span>
                  {item.name === "Calendar" && pendingCount > 0 && (
                    <span className="badge badge-warning badge-sm text-[10px] font-bold shrink-0">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="px-1 pt-2">
        <button
          type="button"
          data-tour="tour-btn"
          onClick={() => startProductTour()}
          className="w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium border border-dashed border-base-300 text-base-content/60 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <span aria-hidden>◎</span>
          Take a tour
        </button>
      </div>
    </nav>
  );
}
