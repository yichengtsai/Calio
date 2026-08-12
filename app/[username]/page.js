import { notFound } from "next/navigation";
import { Suspense } from "react";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import EventType from "@/models/EventType";
import Booking from "@/models/Booking";
import config from "@/config";
import SocialLinks from "@/components/SocialLinks";
import EventTypePicker from "@/components/EventTypePicker";

export default async function PublicProfilePage({ params }) {
  const { username } = await params;

  await connectMongo();

  const user = await User.findOne({ username });
  if (!user) notFound();

  const eventTypeDocs = await EventType.find({
    user: user._id,
    isActive: true,
  })
    .sort({ createdAt: 1 })
    .lean();

  const confirmedCount = await Booking.countDocuments({
    organizer: user._id,
    status: "confirmed",
  });

  const brandColor = user.brandColor || "#6366f1";
  const displayLogo = user.logoUrl || user.image;

  // Client component 只能吃單純物件——Mongoose 文件(含 ObjectId)不能直接跨 server/client 邊界傳,
  // 所以這裡整理成 BookingWidget 需要的乾淨形狀。
  const eventTypes = eventTypeDocs.map((et) => ({
    slug: et.slug,
    title: et.title,
    description: et.description || "",
    duration: et.duration,
    location: et.location || "",
    locationType: et.locationType || "custom",
    color: et.color || brandColor,
  }));

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

        {/* 選活動類型 → 選好之後日曆原地展開 */}
        <Suspense fallback={<div className="h-48 rounded-2xl bg-base-200/40 animate-pulse" />}>
          <EventTypePicker
            username={username}
            eventTypes={eventTypes}
            organizerName={user.name}
            organizerImage={displayLogo}
            brandColor={brandColor}
          />
        </Suspense>

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
        <p className="text-center text-xs text-base-content/30">Powered by {config.appName}</p>
      </div>
    </main>
  );
}
