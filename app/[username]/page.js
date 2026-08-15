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

  const user = await User.findOne({ username }).lean();
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
  const displayLogo = user.logoUrl || user.image || null;

  const eventTypes = eventTypeDocs.map((et) => ({
    slug: et.slug,
    title: et.title,
    description: et.description || "",
    duration: et.duration,
    location: et.location || "",
    locationType: et.locationType || "custom",
    color: et.color || brandColor,
    requiresSessionPackage: Boolean(et.requiresSessionPackage),
  }));

  // Client Component 只能收 plain object，不能傳 Mongoose document
  const socialUser = {
    linkedin: user.linkedin || "",
    website: user.website || "",
    instagram: user.instagram || "",
    socialLinks: user.socialLinks || undefined,
  };

  return (
    <main className="min-h-screen py-12 px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="rounded-2xl border border-base-300 bg-base-200 p-8 text-center space-y-2.5">
          {displayLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayLogo}
              alt={user.name || ""}
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
            <p className="text-base-content/60 text-sm max-w-md mx-auto whitespace-pre-line">
              {user.welcomeMessage || user.bio}
            </p>
          )}

          <SocialLinks user={socialUser} />

          {confirmedCount > 0 && (
            <p className="text-xs text-base-content/40">
              {confirmedCount} confirmed booking{confirmedCount === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <Suspense fallback={<div className="h-64 rounded-2xl bg-base-200 animate-pulse" />}>
          <EventTypePicker
            username={username}
            eventTypes={eventTypes}
            organizerName={user.name || ""}
            organizerImage={displayLogo}
            brandColor={brandColor}
          />
        </Suspense>

        <p className="text-center text-xs text-base-content/30">
          Powered by {config.appName}
        </p>
      </div>
    </main>
  );
}
