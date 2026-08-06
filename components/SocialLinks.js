"use client";

function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.94v5.666H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM7.5 8a1.5 1.5 0 013 0v.5h-3V8zM10 4a5.978 5.978 0 00-4.243 1.757 6.02 6.02 0 00-.673.789A6.5 6.5 0 0010 4zm0 0c1.632 0 3.11.633 4.243 1.757a6.02 6.02 0 01.673.789A6.5 6.5 0 0010 4zM4.062 8h11.876a6.478 6.478 0 000 4H4.062a6.478 6.478 0 010-4zm.462 5.5a6.5 6.5 0 004.219 3.243A9.98 9.98 0 016.7 13.5h-2.176zm10.014 0h-2.176a9.98 9.98 0 01-2.043 3.243 6.5 6.5 0 004.219-3.243zM6.7 6.5a9.98 9.98 0 012.043-3.243A6.5 6.5 0 004.524 6.5H6.7zm6.6 0a9.98 9.98 0 00-2.043-3.243A6.5 6.5 0 0115.476 6.5h-2.176z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.332.014 7.052.072 2.695.272.273 2.69.073 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.332 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.668-.072-4.948-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

const ICONS = {
  linkedin: LinkedinIcon,
  website: WebsiteIcon,
  instagram: InstagramIcon,
};

/**
 * 社群連結圖示列。只顯示有填寫網址的那幾個。
 * @param {{ socialLinks: { linkedin?: string, website?: string, instagram?: string }, brandColor: string }} props
 */
export default function SocialLinks({ socialLinks, brandColor = "#6366f1" }) {
  const links = [
    { key: "linkedin", url: socialLinks?.linkedin },
    { key: "website", url: socialLinks?.website },
    { key: "instagram", url: socialLinks?.instagram },
  ].filter((s) => s.url);

  if (links.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      {links.map(({ key, url }) => {
        const Icon = ICONS[key];
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={key}
            className="w-9 h-9 rounded-full border border-base-300 flex items-center justify-center text-base-content/60 transition-colors hover:text-white"
            style={{ "--hover-bg": brandColor }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = brandColor;
              e.currentTarget.style.borderColor = brandColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "";
              e.currentTarget.style.borderColor = "";
            }}
          >
            <Icon />
          </a>
        );
      })}
    </div>
  );
}
