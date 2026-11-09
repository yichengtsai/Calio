import { notFound } from "next/navigation";
import { Suspense } from "react";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import EventType from "@/models/EventType";
import Booking from "@/models/Booking";
import config from "@/config";
import SocialLinks from "@/components/SocialLinks";
import EventTypePicker from "@/components/EventTypePicker";
import FeedbackForm from "@/components/FeedbackForm";

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
  const tags = Array.isArray(user.tags) ? user.tags.filter(Boolean).slice(0, 6) : [];
  const policyNotes = (user.policyNotes || "").trim();

  const eventTypes = eventTypeDocs.map((et) => ({
    slug: et.slug,
    title: et.title,
    description: et.description || "",
    duration: et.duration,
    location: et.location || "",
    locationType: et.locationType || "custom",
    color: et.color || brandColor,
    requiresSessionPackage: Boolean(et.requiresSessionPackage),
    price: et.price != null ? Number(et.price) : null,
    currency: et.currency || "TWD",
  }));

  // SocialLinks expects { socialLinks, brandColor } — not user={...}
  const socialLinks = {
    linkedin: user.socialLinks?.linkedin || user.linkedin || "",
    website: user.socialLinks?.website || user.website || "",
    instagram: user.socialLinks?.instagram || user.instagram || "",
  };

  return (
    <main className="min-h-screen bg-base-200">
      <div className="mx-auto w-full max-w-4xl px-3 py-5 sm:px-6 sm:py-10 lg:px-8 lg:py-12 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="overflow-hidden rounded-xl bg-base-100 shadow-sm ring-1 ring-base-content/5">
          <div className="lg:grid lg:grid-cols-[minmax(240px,300px)_1fr]">
            {/* Profile */}
            <div className="border-b border-base-300 px-4 py-5 sm:px-8 lg:border-b-0 lg:border-r lg:py-9">
              <div className="flex flex-row items-start gap-4 lg:flex-col lg:items-stretch">
                {displayLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayLogo}
                    alt=""
                    className="size-14 shrink-0 rounded-full object-cover sm:size-16"
                    style={{ boxShadow: `0 0 0 1px ${brandColor}33` }}
                  />
                ) : (
                  <div
                    className="flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white sm:size-16"
                    style={{ backgroundColor: brandColor }}
                  >
                    {(user.name || "?").charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div>
                    <h1 className="text-lg font-semibold tracking-tight text-base-content sm:text-xl">
                      {user.name}
                    </h1>
                    {user.title ? (
                      <p className="mt-0.5 text-sm text-base-content/55">{user.title}</p>
                    ) : null}
                  </div>

                  {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                          style={{
                            color: brandColor,
                            backgroundColor: `${brandColor}14`,
                            borderColor: `${brandColor}33`,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {(user.welcomeMessage || user.bio) ? (
                    <p className="text-sm leading-relaxed text-base-content/50 whitespace-pre-line">
                      {user.welcomeMessage || user.bio}
                    </p>
                  ) : null}

                  <div className="pt-1">
                    <SocialLinks socialLinks={socialLinks} brandColor={brandColor} />
                  </div>

                  {policyNotes ? (
                    <details className="group rounded-lg border border-base-300 bg-base-200/50 open:bg-base-200/70">
                      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-base-content/70 flex items-center justify-between gap-2">
                        <span>Booking notes</span>
                        <span className="text-base-content/40 group-open:rotate-180 transition-transform">
                          ▾
                        </span>
                      </summary>
                      <div className="px-3 pb-3 text-sm text-base-content/60 whitespace-pre-line leading-relaxed border-t border-base-300/60 pt-2">
                        {policyNotes}
                      </div>
                    </details>
                  ) : null}

                  {confirmedCount > 0 ? (
                    <p className="text-xs text-base-content/40">
                      {confirmedCount} confirmed booking
                      {confirmedCount === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Meetings */}
            <div className="px-3 py-4 sm:px-6 sm:py-6 lg:py-8">
              <h2 className="mb-2.5 px-1 text-sm font-medium text-base-content/70">
                Select a meeting
              </h2>
              <Suspense
                fallback={
                  <div className="h-40 animate-pulse rounded-xl bg-base-200" />
                }
              >
                <EventTypePicker
                  username={username}
                  eventTypes={eventTypes}
                  organizerName={user.name || ""}
                  organizerImage={displayLogo}
                  brandColor={brandColor}
                />
              </Suspense>
            </div>
          </div>
        </div>

        <div className="mt-6 max-w-md mx-auto lg:mx-0 lg:max-w-none">
          <FeedbackForm username={username} compact />
        </div>

        <p className="mt-8 text-center text-xs text-base-content/35 lg:text-left">
          Powered by {config.appName}
        </p>
      </div>
    </main>
  );
}
