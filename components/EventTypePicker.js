"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import BookingWidget from "@/components/BookingWidget";

function getLocationType(et) {
  const structured = et?.locationType;
  if (structured === "google_meet" || structured === "video") return "video";
  if (structured === "phone") return "phone";
  if (structured === "in_person") return "in-person";

  const location = et?.location;
  if (!location) return null;
  const l = location.toLowerCase();
  if (/phone|call/.test(l)) return "phone";
  if (/https?:\/\/|zoom|meet|teams/.test(l)) return "video";
  return "in-person";
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M2 4.5A1.5 1.5 0 013.5 3h7A1.5 1.5 0 0112 4.5v3.879l3.211-2.157A.75.75 0 0116.5 6.8v6.4a.75.75 0 01-1.289.578L12 11.621V15.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 15.5v-11z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path
        fillRule="evenodd"
        d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-.826 1.68l-1.293.646a11.037 11.037 0 006.208 6.208l.646-1.293a1.5 1.5 0 011.68-.826l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15C7.82 18 2 12.18 2 5V3.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path
        fillRule="evenodd"
        d="M9.69 18.933c.09.043.194.043.284 0 .108-.052 2.751-1.35 4.786-3.463C16.15 13.981 17.5 11.955 17.5 9.5a7.5 7.5 0 10-15 0c0 2.455 1.35 4.481 2.74 5.97 2.035 2.113 4.678 3.411 4.786 3.463h-.336zM10 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const LOCATION_META = {
  video: { icon: <VideoIcon />, label: "Video call" },
  phone: { icon: <PhoneIcon />, label: "Phone call" },
  "in-person": { icon: <PinIcon />, label: "In person" },
};

export default function EventTypePicker({ username, eventTypes, organizerName, organizerImage, brandColor }) {
  const searchParams = useSearchParams();
  // 舊版 /username/slug 網址現在會轉址回這裡並帶 ?event=slug,
  // 讓分享出去的舊連結還是能直接展開對應的日曆,不用使用者自己重選一次。
  const eventFromQuery = searchParams.get("event");
  const initialSlug = eventTypes.some((et) => et.slug === eventFromQuery) ? eventFromQuery : null;

  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const widgetRef = useRef(null);

  const selected = eventTypes.find((et) => et.slug === selectedSlug) || null;

  // 選好項目、日曆展開之後,順手滾到看得到的地方,尤其手機版列表比較長的時候有感。
  // 如果是從舊連結帶 ?event= 進來、一開始就自動選好的,就不用特地滾,畫面本來就在頂部。
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (selected && widgetRef.current) {
      widgetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selected]);

  if (selected) {
    return (
      <div ref={widgetRef} className="space-y-4 animate-appearFromRight scroll-mt-6">
        <button
          type="button"
          onClick={() => setSelectedSlug(null)}
          className="text-sm text-base-content/50 hover:text-base-content flex items-center gap-1"
        >
          ← Choose a different type
        </button>

        <BookingWidget
          key={selected.slug}
          username={username}
          slug={selected.slug}
          organizerName={organizerName}
          organizerImage={organizerImage}
          brandColor={brandColor}
          eventType={selected}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-base-200/40 p-5 sm:p-6 space-y-4 animate-opacity">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold">What would you like to book?</h2>
        <p className="text-xs text-base-content/45">Times are shown in your local timezone.</p>
      </div>

      {eventTypes.length === 0 ? (
        <p className="text-center text-base-content/50 text-sm py-6">
          No booking types are open right now — check back soon.
        </p>
      ) : (
        <div className="space-y-3">
          {eventTypes.map((et) => {
            const locationType = getLocationType(et);
            const meta = locationType ? LOCATION_META[locationType] : null;

            return (
              <button
                key={et.slug}
                type="button"
                onClick={() => setSelectedSlug(et.slug)}
                className="group block w-full text-left rounded-xl border border-base-300 bg-base-100 p-5 transition-all hover:border-[var(--brand-color)] hover:shadow-md active:scale-[0.99]"
                style={{ "--brand-color": et.color || brandColor }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: et.color }}
                  />
                  <p className="font-semibold">{et.title}</p>
                </div>

                <div className="flex items-center gap-3 text-xs text-base-content/50 mb-2">
                  <span className="flex items-center gap-1">
                    <ClockIcon />
                    {et.duration} min
                  </span>
                  {meta && (
                    <span className="flex items-center gap-1">
                      {meta.icon}
                      {meta.label}
                    </span>
                  )}
                </div>

                {et.description && (
                  <p className="text-sm text-base-content/60 leading-relaxed">{et.description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
