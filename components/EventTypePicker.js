"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import BookingWidget from "@/components/BookingWidget";
import TimezoneSelect from "@/components/TimezoneSelect";

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

function formatPrice(price, currency = "TWD") {
  if (price == null || price === "" || Number.isNaN(Number(price))) return null;
  const n = Number(price);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "TWD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency || ""} ${n}`.trim();
  }
}

function storageKey(username) {
  return `calio-booking-identity:${username || ""}`;
}

function loadStoredIdentity(username) {
  if (typeof window === "undefined" || !username) return null;
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.email) return null;
    return {
      email: String(data.email).trim().toLowerCase(),
      name: data.name ? String(data.name).trim() : "",
      timezone: data.timezone ? String(data.timezone) : "",
    };
  } catch {
    return null;
  }
}

function saveStoredIdentity(username, { email, name, timezone }) {
  if (typeof window === "undefined" || !username || !email) return;
  try {
    const prev = loadStoredIdentity(username) || {};
    localStorage.setItem(
      storageKey(username),
      JSON.stringify({
        email: String(email).trim().toLowerCase(),
        name: name ? String(name).trim() : prev.name || "",
        timezone: timezone || prev.timezone || "",
      })
    );
  } catch {
    /* ignore */
  }
}

function clearStoredIdentity(username) {
  if (typeof window === "undefined" || !username) return;
  try {
    localStorage.removeItem(storageKey(username));
  } catch {
    /* ignore */
  }
}

const LOCATION_META = {
  video: { icon: <VideoIcon />, label: "Video call" },
  phone: { icon: <PhoneIcon />, label: "Phone call" },
  "in-person": { icon: <PinIcon />, label: "In person" },
};

/**
 * Flow: email → course list (must pick timezone before opening a course) → BookingWidget
 * Email + timezone remembered in localStorage per coach username.
 */
export default function EventTypePicker({
  username,
  eventTypes,
  organizerName,
  organizerImage,
  brandColor,
}) {
  const searchParams = useSearchParams();
  const eventFromQuery = searchParams.get("event");
  const initialSlug = eventTypes.some((et) => et.slug === eventFromQuery)
    ? eventFromQuery
    : null;

  const [phase, setPhase] = useState("identify"); // identify | pick | book
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [courses, setCourses] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);
  const [pendingSlug, setPendingSlug] = useState(initialSlug);
  const [restored, setRestored] = useState(false);
  const [tzHint, setTzHint] = useState(false);

  const widgetRef = useRef(null);
  const isFirstRender = useRef(true);

  const selected =
    courses.find((et) => et.slug === selectedSlug) ||
    eventTypes.find((et) => et.slug === selectedSlug) ||
    null;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (phase === "book" && selected && widgetRef.current) {
      widgetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase, selected]);

  async function lookupCourses(nextEmail, nextName, { remember = true } = {}) {
    const em = String(nextEmail || "").trim().toLowerCase();
    if (!em) return;
    setError(null);
    setIsChecking(true);
    try {
      const res = await fetch(
        `/api/public/student-courses?username=${encodeURIComponent(
          username
        )}&email=${encodeURIComponent(em)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not look up courses");
        return;
      }
      const resolvedName = data.inviteeName || nextName || "";
      if (resolvedName) setName(resolvedName);
      setEmail(em);

      const list = data.courses || [];
      setCourses(list);

      if (remember) {
        saveStoredIdentity(username, {
          email: em,
          name: resolvedName,
          timezone,
        });
      }

      const want = pendingSlug;
      if (want && list.some((c) => c.slug === want)) {
        // Still need timezone before auto-opening
        if (timezone) {
          setSelectedSlug(want);
          setPhase("book");
          return;
        }
        setPhase("pick");
        setTzHint(true);
        return;
      }

      if (list.length === 0) {
        setError(
          "No bookable courses for this email. Check that it matches the address used for your session package, or contact the host."
        );
        setPhase("pick");
        return;
      }

      setPhase("pick");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsChecking(false);
    }
  }

  // Restore email + timezone after refresh
  useEffect(() => {
    if (restored) return;
    const stored = loadStoredIdentity(username);
    setRestored(true);
    if (stored?.timezone) setTimezone(stored.timezone);
    if (!stored?.email) {
      // Suggest browser timezone as default selection value only after identify
      return;
    }
    setEmail(stored.email);
    if (stored.name) setName(stored.name);
    lookupCourses(stored.email, stored.name, { remember: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, restored]);

  async function handleIdentify(e) {
    e.preventDefault();
    // Default timezone to browser if not set yet (user can change on next step)
    if (!timezone) {
      try {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (browserTz) setTimezone(browserTz);
      } catch {
        /* ignore */
      }
    }
    await lookupCourses(email, name, { remember: true });
  }

  function handleTimezoneChange(tz) {
    setTimezone(tz);
    setTzHint(false);
    if (email) {
      saveStoredIdentity(username, { email, name, timezone: tz });
    }
  }

  function handleSelectCourse(slug) {
    if (!timezone) {
      setTzHint(true);
      return;
    }
    saveStoredIdentity(username, { email, name, timezone });
    setSelectedSlug(slug);
    setPhase("book");
  }

  function handleBackToPick() {
    setSelectedSlug(null);
    setPhase("pick");
  }

  function handleChangeEmail() {
    setSelectedSlug(null);
    setCourses([]);
    setError(null);
    setPendingSlug(null);
    setTzHint(false);
    clearStoredIdentity(username);
    setTimezone("");
    setPhase("identify");
  }

  // —— Step 1: email ——
  if (phase === "identify") {
    return (
      <div className="rounded-2xl border border-base-300 bg-base-200 overflow-hidden shadow-sm">
        <div className="h-1.5" style={{ backgroundColor: brandColor }} />
        <form onSubmit={handleIdentify} className="p-6 sm:p-8 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold">Enter your email to book</h2>
            <p className="text-sm text-base-content/60">
              We&apos;ll show courses available for you, remaining sessions, and
              pricing.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered w-full"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Name{" "}
              <span className="text-base-content/40 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input input-bordered w-full"
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={isChecking}
            style={{ backgroundColor: brandColor, borderColor: brandColor }}
            className="btn w-full text-white border-0"
          >
            {isChecking ? "Checking…" : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  // —— Step 3: booking widget ——
  if (phase === "book" && selected) {
    return (
      <div ref={widgetRef} className="space-y-4 animate-appearFromRight scroll-mt-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={handleBackToPick}
            className="text-base-content/50 hover:text-base-content flex items-center gap-1"
          >
            ← Choose a different course
          </button>
          <span className="text-base-content/30">·</span>
          <button
            type="button"
            onClick={handleChangeEmail}
            className="text-base-content/50 hover:text-base-content"
          >
            Change email ({email})
          </button>
        </div>

        <BookingWidget
          key={`${selected.slug}-${timezone}`}
          username={username}
          slug={selected.slug}
          organizerName={organizerName}
          organizerImage={organizerImage}
          brandColor={brandColor}
          eventType={selected}
          initialEmail={email}
          initialName={name}
          initialTimezone={timezone}
          initialRemainingSessions={
            selected.requiresSessionPackage ? selected.remainingSessions : null
          }
          onTimezoneChange={handleTimezoneChange}
        />
      </div>
    );
  }

  // —— Step 2: timezone + course list ——
  const packageCourses = courses.filter((c) => c.requiresSessionPackage);
  const openCourses = courses.filter((c) => !c.requiresSessionPackage);
  const canOpenCourse = Boolean(timezone);

  function CourseCard({ et }) {
    const locationType = getLocationType(et);
    const meta = locationType ? LOCATION_META[locationType] : null;
    const priceLabel = formatPrice(et.price, et.currency);
    const isPackage = Boolean(et.requiresSessionPackage);

    return (
      <button
        type="button"
        onClick={() => handleSelectCourse(et.slug)}
        disabled={!canOpenCourse}
        className={`group block w-full text-left rounded-xl border border-base-300 bg-base-100 p-5 transition-all ${
          canOpenCourse
            ? "hover:border-[var(--brand-color)] hover:shadow-md active:scale-[0.99]"
            : "opacity-50 cursor-not-allowed"
        }`}
        style={{ "--brand-color": et.color || brandColor }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: et.color }}
            />
            <p className="font-semibold truncate">{et.title}</p>
          </div>
          {isPackage ? (
            <span className="shrink-0 badge badge-success badge-sm">Package</span>
          ) : (
            <span className="shrink-0 badge badge-ghost badge-sm">Open</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/50 mb-2">
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
          <div className="mb-3 rounded-lg bg-base-200/60 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-base-content/40 mb-0.5">
              About this session
            </p>
            <p className="text-sm text-base-content/70 leading-relaxed whitespace-pre-line line-clamp-4">
              {et.description}
            </p>
          </div>
        )}

        {isPackage && (
          <div className="rounded-lg bg-success/10 border border-success/20 px-3 py-2.5 space-y-1 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-success">
                {et.remainingSessions ?? 0} session
                {(et.remainingSessions ?? 0) === 1 ? "" : "s"} available
                {et.totalSessions != null ? (
                  <span className="font-normal text-success/70">
                    {" "}
                    / {et.totalSessions} total
                  </span>
                ) : null}
              </span>
              {priceLabel && (
                <span className="text-sm font-bold text-base-content">
                  {priceLabel}
                  <span className="text-xs font-normal text-base-content/50">
                    {" "}
                    ref.
                  </span>
                </span>
              )}
            </div>
            {(et.reservedSessions > 0 || et.usedSessions > 0) && (
              <p className="text-xs text-success/80">
                {et.reservedSessions > 0
                  ? `${et.reservedSessions} already booked (not yet completed)`
                  : null}
                {et.reservedSessions > 0 && et.usedSessions > 0 ? " · " : ""}
                {et.usedSessions > 0 ? `${et.usedSessions} completed` : null}
              </p>
            )}
            <p className="text-xs text-base-content/55 leading-relaxed">
              Linked to your session package. Available count excludes upcoming
              bookings. One session is deducted after the class starts.
            </p>
          </div>
        )}

        {!isPackage && (
          <div className="rounded-lg bg-base-200/80 border border-base-300 px-3 py-2.5 space-y-1 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-base-content/70">
                No package required — book directly
              </span>
              {priceLabel && (
                <span className="text-sm font-bold text-base-content">
                  {priceLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-base-content/55 leading-relaxed">
              Pick a time → confirm your details. Payment or approval (if any)
              will be handled by the host.
            </p>
          </div>
        )}

        <p
          className={`text-xs font-medium ${
            canOpenCourse ? "text-primary group-hover:underline" : "text-base-content/40"
          }`}
        >
          {canOpenCourse ? "Select a time →" : "Select your timezone first"}
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-base-200/40 p-5 sm:p-6 space-y-5 animate-opacity">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-lg font-bold">Your available courses</h2>
          <p className="text-xs text-base-content/45">
            Signed in as{" "}
            <span className="font-medium text-base-content/70">{email}</span>
            {name ? ` · ${name}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={handleChangeEmail}
          className="btn btn-ghost btn-xs self-start"
        >
          Change email
        </button>
      </div>

      {/* Timezone required before opening a course */}
      <div
        className={`rounded-xl border px-4 py-3 space-y-2 ${
          tzHint || !timezone
            ? "border-warning/50 bg-warning/5"
            : "border-base-300 bg-base-100"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-base-content">
              Your timezone <span className="text-error">*</span>
            </p>
            <p className="text-xs text-base-content/50 mt-0.5">
              Required before you can open a course. Times will be shown in this
              timezone. Your choice is remembered on this device.
            </p>
          </div>
        </div>
        <TimezoneSelect value={timezone || null} onChange={handleTimezoneChange} />
        {(tzHint || !timezone) && (
          <p className="text-xs text-warning font-medium">
            Please select a timezone to continue.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-base-300 bg-base-100 px-4 py-3 text-sm text-base-content/70 space-y-1">
        <p className="font-medium text-base-content">How to book</p>
        <ol className="list-decimal list-inside text-xs space-y-0.5 text-base-content/55">
          <li>Confirm your timezone above</li>
          <li>Choose a package course or an open course</li>
          <li>Pick a date and time, then submit</li>
        </ol>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {courses.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-base-content/50 text-sm">
            No bookable courses for this email.
          </p>
          <p className="text-xs text-base-content/40">
            If you purchased sessions, confirm the email matches, or ask the host
            to activate a package.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {packageCourses.length > 0 && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Package courses
                </h3>
                <p className="text-xs text-base-content/45 mt-0.5">
                  Courses linked to your session package, with remaining count.
                </p>
              </div>
              <div className="space-y-3">
                {packageCourses.map((et) => (
                  <CourseCard key={et.slug} et={et} />
                ))}
              </div>
            </section>
          )}

          {openCourses.length > 0 && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-base-content/30" />
                  Open courses
                </h3>
                <p className="text-xs text-base-content/45 mt-0.5">
                  No package required — anyone can request a time.
                </p>
              </div>
              <div className="space-y-3">
                {openCourses.map((et) => (
                  <CourseCard key={et.slug} et={et} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
