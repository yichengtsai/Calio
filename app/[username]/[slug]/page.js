import { notFound } from "next/navigation";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import EventType from "@/models/EventType";
import BookingWidget from "@/components/BookingWidget";
import SocialLinks from "@/components/SocialLinks";
import config from "@/config";

export default async function BookingPage({ params }) {
  const { username, slug } = await params;

  await connectMongo();

  const user = await User.findOne({ username });
  if (!user) notFound();

  const eventType = await EventType.findOne({
    user: user._id,
    slug,
    isActive: true,
  });
  if (!eventType) notFound();

  const brandColor = user.brandColor || "#6366f1";

  return (
    <main className="min-h-screen py-16 px-6">
      <div className="max-w-md mx-auto space-y-5">
        <BookingWidget
          username={username}
          slug={slug}
          organizerName={user.name}
          organizerImage={user.logoUrl || user.image}
          brandColor={brandColor}
          eventType={{
            title: eventType.title,
            description: eventType.description,
            duration: eventType.duration,
            location: eventType.location,
            color: eventType.color,
          }}
        />

        <SocialLinks
          socialLinks={{
            linkedin: user.socialLinks?.linkedin || "",
            website: user.socialLinks?.website || "",
            instagram: user.socialLinks?.instagram || "",
          }}
          brandColor={brandColor}
        />

        <p className="text-center text-xs text-base-content/30">
          Powered by {config.appName}
        </p>
      </div>
    </main>
  );
}

