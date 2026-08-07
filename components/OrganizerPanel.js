import SocialLinks from "@/components/SocialLinks";

export default function OrganizerPanel({ name, image, bio, brandColor = "#6366f1", socialLinks }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            className="w-16 h-16 rounded-full object-cover shrink-0 ring-2 ring-base-100"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-white text-2xl font-bold"
            style={{ backgroundColor: brandColor }}
          >
            {name?.charAt(0) || "?"}
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold leading-tight">{name}</h2>
        </div>
      </div>

      {bio && <p className="text-sm text-base-content/60 leading-relaxed">{bio}</p>}

      <SocialLinks socialLinks={socialLinks} brandColor={brandColor} />
    </div>
  );
}
