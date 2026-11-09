"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ProductTour, { isTourDone } from "@/components/ProductTour";

/**
 * Mount once in dashboard layout. Event: "calio-start-tour".
 * Tour only runs on /dashboard — no jumps to other pages.
 * sessionKey remounts ProductTour so it always starts at step 1.
 */
export default function ProductTourHost({ autoStart = false }) {
  const [open, setOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function start() {
      const begin = () => {
        setSessionKey((k) => k + 1);
        setOpen(true);
      };
      if (pathname !== "/dashboard") {
        router.push("/dashboard");
        setTimeout(begin, 300);
      } else {
        begin();
      }
    }
    window.addEventListener("calio-start-tour", start);
    return () => window.removeEventListener("calio-start-tour", start);
  }, [pathname, router]);

  useEffect(() => {
    if (!autoStart) return;
    if (isTourDone()) return;
    if (pathname !== "/dashboard") return;
    const t = setTimeout(() => {
      setSessionKey((k) => k + 1);
      setOpen(true);
    }, 600);
    return () => clearTimeout(t);
  }, [autoStart, pathname]);

  if (!open) return null;

  return (
    <ProductTour
      key={sessionKey}
      open={open}
      onClose={() => setOpen(false)}
    />
  );
}

export function startProductTour() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("calio-start-tour"));
  }
}
