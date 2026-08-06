import { notFound } from "next/navigation";
import Link from "next/link";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import EventType from "@/models/EventType";
import Booking from "@/models/Booking";
import config from "@/config";
import SocialLinks from "@/components/SocialLinks";

function getLocationType(location) {
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

export default async function PublicProfilePage({ params }) {
  const { username } = await params;

  await connectMongo();

  const user = await User.findOne({ username });
  if (!user) notFound();

  const eventTypes = await EventType.find({
    user: user._id,
    isActive: true,
  }).sort({ createdAt: 1 });

  const confirmedCount = await Booking.countDocuments({
    organizer: user._id,
    status: "confirmed",
  });

  const brandColor = user.brandColor || "#6366f1";
  const displayLogo = user.logoUrl || user.image;

  return (
    <main className="min-h-screen py-12 px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 個人/品牌區塊 */}
        <div className="rounded-2xl border border-base-300 bg-base-200 p-8 text-center space-y-2.5">
          {displayLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayLogo}
              alt={user.name}
              className="w-20 h-20 rounded-full mx-auto object-cover mb-1"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold mb-1"
              style={{ backgroundColor: brandColor }}
            >
              {user.name?.charAt(0) || "?"}
            </div>
          )}

          <div>
            <h1 className="text-2xl font-extrabold">{user.name}</h1>
            {user.title && (
              <p className="text-sm font-medium mt-0.5" style={{ color: brandColor }}>
                {user.title}
              </p>
            )}
          </div>

          {(user.welcomeMessage || user.bio) && (
            <p className="text-base-content/70 text-sm max-w-md mx-auto leading-relaxed pt-1">
              {user.welcomeMessage || user.bio}
            </p>
          )}

          {user.tags?.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
              {user.tags.map((tag) => (
                <span key={tag} className="badge badge-ghost badge-sm">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="pt-1">
            <SocialLinks
              socialLinks={{
                linkedin: user.socialLinks?.linkedin || "",
                website: user.socialLinks?.website || "",
                instagram: user.socialLinks?.instagram || "",
              }}
              brandColor={brandColor}
            />
          </div>

          {confirmedCount > 0 && (
            <p className="text-[11px] text-base-content/35 pt-1">
              {confirmedCount}+ meeting{confirmedCount === 1 ? "" : "s"} booked so far
            </p>
          )}
        </div>

        {/* 選擇活動類型 */}
        <div className="rounded-2xl bg-base-200/40 p-5 sm:p-6 space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold">What would you like to book?</h2>
            <p className="text-xs text-base-content/45">
              Times are shown in your local timezone.
            </p>
          </div>

          {eventTypes.length === 0 ? (
            <p className="text-center text-base-content/50 text-sm py-6">
              No booking types are open right now — check back soon.
            </p>
          ) : (
            <div className="space-y-3">
              {eventTypes.map((et) => {
                const locationType = getLocationType(et.location);
                const meta = locationType ? LOCATION_META[locationType] : null;

                return (
                  <Link
                    key={et._id}
                    href={`/${username}/${et.slug}`}
                    className="group block rounded-xl border border-base-300 bg-base-100 p-5 transition-all hover:border-[var(--brand-color)] hover:shadow-md"
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
                      <p className="text-sm text-base-content/60 leading-relaxed">
                        {et.description}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 預約須知 */}
        {user.policyNotes && (
          <details className="rounded-xl border border-base-300 bg-base-200 px-5 py-4">
            <summary className="text-sm font-medium cursor-pointer select-none">
              Good to know before you book
            </summary>
            <p className="text-sm text-base-content/60 mt-3 whitespace-pre-line leading-relaxed">
              {user.policyNotes}
            </p>
          </details>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-base-content/30">
          Powered by {config.appName}
        </p>
      </div>
    </main>
  );
}
