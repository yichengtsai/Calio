"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startProductTour } from "@/components/ProductTourHost";

/** /dashboard/guide → workspace + start tour (no separate guide page) */
export default function GuideRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
    const t = setTimeout(() => startProductTour(), 350);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh] text-sm text-base-content/50">
      Starting tour…
    </div>
  );
}
