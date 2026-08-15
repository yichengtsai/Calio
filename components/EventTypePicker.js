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

const LOCATION_META = {
  video: { icon: <VideoIcon />, label: "Video call" },
  phone: { icon: <PhoneIcon />, label: "Phone call" },
  "in-person": { icon: <PinIcon />, label: "In person" },
};

/**
 * 預約流程：
 * 1. identify — 先填 email
 * 2. pick — 依 email 顯示可預約課程（剩餘堂數、價錢）
 * 3. book — 進入 BookingWidget 選時段
 *
 * 舊連結 ?event=slug 仍支援：有 email 時直接進該課；無 email 則 identify 後自動選該課。
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
  const [courses, setCourses] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);
  const [pendingSlug, setPendingSlug] = useState(initialSlug);

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

  async function handleIdentify(e) {
    e.preventDefault();
    setError(null);
    setIsChecking(true);
    try {
      const res = await fetch(
        `/api/public/student-courses?username=${encodeURIComponent(
          username
        )}&email=${encodeURIComponent(email.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not look up courses");
        return;
      }
      if (data.inviteeName && !name) setName(data.inviteeName);

      const list = data.courses || [];
      setCourses(list);

      // 舊連結指定某一課：若該課在可約列表中，直接進入
      const want = pendingSlug;
      if (want && list.some((c) => c.slug === want)) {
        setSelectedSlug(want);
        setPhase("book");
        return;
      }

      if (list.length === 0) {
        setError(
          "No bookable courses for this email. Please contact the host to activate a session package, or check the email address."
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

  function handleSelectCourse(slug) {
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
    setPhase("identify");
  }

  // —— Step 1: email ——
  if (phase === "identify") {
    return (
      <div className="rounded-2xl border border-base-300 bg-base-200 overflow-hidden shadow-sm">
        <div className="h-1.5" style={{ backgroundColor: brandColor }} />
        <form onSubmit={handleIdentify} className="p-6 sm:p-8 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold">請先輸入 Email 才能預約</h2>
            <p className="text-sm text-base-content/60">
              輸入學員 Email 後，才會顯示你可預約的課程、剩餘堂數與費用。
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
              Name <span className="text-base-content/40 font-normal">(optional)</span>
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
            {isChecking ? "查詢中…" : "繼續查看可預約課程"}
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
          key={selected.slug}
          username={username}
          slug={selected.slug}
          organizerName={organizerName}
          organizerImage={organizerImage}
          brandColor={brandColor}
          eventType={selected}
          initialEmail={email}
          initialName={name}
          initialRemainingSessions={
            selected.requiresSessionPackage ? selected.remainingSessions : null
          }
        />
      </div>
    );
  }

  // —— Step 2: course list ——
  const packageCourses = courses.filter((c) => c.requiresSessionPackage);
  const openCourses = courses.filter((c) => !c.requiresSessionPackage);

  function CourseCard({ et }) {
    const locationType = getLocationType(et);
    const meta = locationType ? LOCATION_META[locationType] : null;
    const priceLabel = formatPrice(et.price, et.currency);
    const isPackage = Boolean(et.requiresSessionPackage);

    return (
      <button
        type="button"
        onClick={() => handleSelectCourse(et.slug)}
        className="group block w-full text-left rounded-xl border border-base-300 bg-base-100 p-5 transition-all hover:border-[var(--brand-color)] hover:shadow-md active:scale-[0.99]"
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
            <span className="shrink-0 badge badge-success badge-sm gap-1">
              堂數方案
            </span>
          ) : (
            <span className="shrink-0 badge badge-ghost badge-sm">開放預約</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/50 mb-2">
          <span className="flex items-center gap-1">
            <ClockIcon />
            {et.duration} 分鐘
          </span>
          {meta && (
            <span className="flex items-center gap-1">
              {meta.icon}
              {meta.label}
            </span>
          )}
        </div>

        {et.description && (
          <p className="text-sm text-base-content/60 leading-relaxed mb-3 line-clamp-2">
            {et.description}
          </p>
        )}

        {/* 方案課：剩餘堂數 + 費用 */}
        {isPackage && (
          <div className="rounded-lg bg-success/10 border border-success/20 px-3 py-2.5 space-y-1 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-success">
                剩餘 {et.remainingSessions ?? 0} 堂
                {et.totalSessions != null ? (
                  <span className="font-normal text-success/70">
                    {" "}
                    / 共 {et.totalSessions} 堂
                  </span>
                ) : null}
              </span>
              {priceLabel && (
                <span className="text-sm font-bold text-base-content">
                  {priceLabel}
                  <span className="text-xs font-normal text-base-content/50">
                    {" "}
                    / 堂參考價
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-base-content/55 leading-relaxed">
              此課程已綁定你的堂數方案。點選後選擇時段即可預約，上課後會扣除 1
              堂。
            </p>
          </div>
        )}

        {/* 開放課：操作說明 */}
        {!isPackage && (
          <div className="rounded-lg bg-base-200/80 border border-base-300 px-3 py-2.5 space-y-1 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-base-content/70">
                無需堂數，可直接預約
              </span>
              {priceLabel && (
                <span className="text-sm font-bold text-base-content">
                  {priceLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-base-content/55 leading-relaxed">
              點選此課程 → 選擇日期與時段 → 確認資料送出。若需付費或審核，教練會再與你聯繫。
            </p>
          </div>
        )}

        <p className="text-xs font-medium text-primary group-hover:underline">
          點此選擇時段 →
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-base-200/40 p-5 sm:p-6 space-y-5 animate-opacity">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-lg font-bold">你可預約的課程</h2>
          <p className="text-xs text-base-content/45">
            目前身分：
            <span className="font-medium text-base-content/70">{email}</span>
            {name ? ` · ${name}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={handleChangeEmail}
          className="btn btn-ghost btn-xs self-start"
        >
          更換 Email
        </button>
      </div>

      {/* 總操作說明 */}
      <div className="rounded-xl border border-base-300 bg-base-100 px-4 py-3 text-sm text-base-content/70 space-y-1">
        <p className="font-medium text-base-content">如何預約？</p>
        <ol className="list-decimal list-inside text-xs space-y-0.5 text-base-content/55">
          <li>下方分為「堂數方案課程」與「開放預約課程」</li>
          <li>點選你要的課程</li>
          <li>在日曆上選擇日期與時段並送出</li>
        </ol>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {courses.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-base-content/50 text-sm">
            這個 Email 目前沒有可預約的課程。
          </p>
          <p className="text-xs text-base-content/40">
            若你已購買堂數，請確認 Email 是否正確，或聯絡教練為你開通方案。
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {packageCourses.length > 0 && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  堂數方案課程
                </h3>
                <p className="text-xs text-base-content/45 mt-0.5">
                  已為你開通的課程，會顯示剩餘堂數；預約並完成上課後扣除 1 堂。
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
                  開放預約課程
                </h3>
                <p className="text-xs text-base-content/45 mt-0.5">
                  不需堂數方案，任何人填完資料即可申請時段。
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
