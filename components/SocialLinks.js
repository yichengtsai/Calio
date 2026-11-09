"use client";

function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.94v5.666H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0" aria-hidden>
      <path
        fillRule="evenodd"
        d="M4.083 9h11.834a6.524 6.524 0 00-1.446-3.884A6.503 6.503 0 0010 2.5a6.503 6.503 0 00-4.471 2.616A6.524 6.524 0 004.083 9zM10 15.5a6.502 6.502 0 004.471-2.616A6.524 6.524 0 0015.917 11H4.083a6.524 6.524 0 001.446 3.884A6.502 6.502 0 0010 15.5zM2.5 10a7.5 7.5 0 1115 0 7.5 7.5 0 01-15 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.332.014 7.052.072 2.695.272.273 2.69.073 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.332 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.668-.072-4.948-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

const ICONS = {
  linkedin: LinkedinIcon,
  website: WebsiteIcon,
  instagram: InstagramIcon,
};

function normalizeUrl(url) {
  const u = (url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

export default function SocialLinks({ socialLinks, brandColor = "#6366f1" }) {
  const links = [
    { key: "linkedin", url: normalizeUrl(socialLinks?.linkedin) },
    { key: "website", url: normalizeUrl(socialLinks?.website) },
    { key: "instagram", url: normalizeUrl(socialLinks?.instagram) },
  ].filter((s) => s.url);

  if (links.length === 0) return null;

  return (
    <div className="flex items-center justify-start gap-2">
      {links.map(({ key, url }) => {
        const Icon = ICONS[key];
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={key}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-base-300 text-base-content/60 transition-colors leading-none"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = brandColor;
              e.currentTarget.style.borderColor = brandColor;
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "";
              e.currentTarget.style.borderColor = "";
              e.currentTarget.style.color = "";
            }}
          >
            <Icon />
          </a>
        );
      })}
    </div>
  );
}
