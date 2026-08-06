"use client";

import { useEffect, useState } from "react";

export default function AccountSettingsForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [usernameBase, setUsernameBase] = useState("");
  const [publicUsername, setPublicUsername] = useState(""); // 含隨機尾碼的完整值,唯讀顯示用
  const [bio, setBio] = useState("");
  const [image, setImage] = useState("");
  const [brandColor, setBrandColor] = useState("#6366f1");
  const [logoUrl, setLogoUrl] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [title, setTitle] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [policyNotes, setPolicyNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);

    async function load() {
      try {
        const res = await fetch("/api/account");
        const data = await res.json();
        setName(data.name || "");
        setUsernameBase(data.usernameBase || "");
        setPublicUsername(data.username || "");
        setBio(data.bio || "");
        setImage(data.image || "");
        setBrandColor(data.brandColor || "#6366f1");
        setLogoUrl(data.logoUrl || "");
        setWelcomeMessage(data.welcomeMessage || "");
        setTitle(data.title || "");
        setLinkedin(data.socialLinks?.linkedin || "");
        setWebsite(data.socialLinks?.website || "");
        setInstagram(data.socialLinks?.instagram || "");
        setPolicyNotes(data.policyNotes || "");
        setTagsInput((data.tags || []).join(", "));
      } catch (e) {
        setResult({ type: "error", message: "Failed to load account info" });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setIsSaving(true);
    setResult(null);

    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username: usernameBase,
          bio,
          brandColor,
          logoUrl,
          welcomeMessage,
          title,
          socialLinks: { linkedin, website, instagram },
          policyNotes,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ type: "error", message: data.error || "Failed to save" });
        return;
      }

      setUsernameBase(data.usernameBase || "");
      setPublicUsername(data.username || "");
      setResult({ type: "success", message: "Saved" });
    } catch (e) {
      setResult({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setIsSaving(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(`${origin}/${publicUsername}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function resizeImageToDataUrl(file, maxSize) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleLogoFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setResult({ type: "error", message: "Please choose an image file" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setResult({ type: "error", message: "Image must be under 5MB" });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      setLogoUrl(dataUrl);
    } catch (err) {
      setResult({ type: "error", message: "Failed to process that image" });
    } finally {
      setIsUploadingLogo(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-lg space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-base-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const displayLogo = logoUrl || image;

  return (
    <div className="max-w-lg space-y-6">
      {/* Public URL preview */}
      {publicUsername && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-base-content/50">Your booking page</p>
            <p className="text-sm font-medium truncate">
              {origin}/{publicUsername}
            </p>
          </div>
          <button type="button" onClick={handleCopy} className="btn btn-sm btn-outline shrink-0">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Profile */}
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={name} className="w-14 h-14 rounded-full" />
            )}
            <div className="flex-1">
              <label className="block text-sm font-medium text-base-content/80 mb-1">
                Display name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Title / role (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input input-bordered w-full"
              placeholder="e.g. Product Designer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Username</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-base-content/40 shrink-0">{origin}/</span>
              <input
                type="text"
                required
                value={usernameBase}
                onChange={(e) => setUsernameBase(e.target.value.toLowerCase())}
                className="input input-bordered w-full"
                placeholder="janedoe"
                pattern="[a-z0-9-]{3,30}"
              />
            </div>
            <p className="text-xs text-base-content/40 mt-1">
              We add a short random code to the end (e.g. {usernameBase || "janedoe"}-x7q) so
              people can&apos;t guess your page and book random slots. Changing this generates a
              new code, which breaks any links you&apos;ve already shared.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Bio (optional)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              maxLength={280}
              className="textarea textarea-bordered w-full"
              placeholder="A short line shown under your name"
            />
            <p className="text-xs text-base-content/40 mt-1 text-right">{bio.length}/280</p>
          </div>
        </div>

        {/* Branding */}
        <div className="space-y-5 pt-6 border-t border-base-300">
          <h3 className="font-semibold text-sm">Booking page branding</h3>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Welcome message (optional)
            </label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={2}
              maxLength={300}
              className="textarea textarea-bordered w-full"
              placeholder="Hey! Thanks for stopping by — pick a time that works for you."
            />
            <p className="text-xs text-base-content/40 mt-1">
              Shown at the top of your booking page instead of your bio, if filled in.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-2">
              Social links (optional)
            </label>
            <div className="space-y-2">
              <input
                type="url"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                className="input input-bordered input-sm w-full"
                placeholder="LinkedIn URL"
              />
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="input input-bordered input-sm w-full"
                placeholder="Website URL"
              />
              <input
                type="url"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="input input-bordered input-sm w-full"
                placeholder="Instagram URL"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Booking notes (optional)
            </label>
            <textarea
              value={policyNotes}
              onChange={(e) => setPolicyNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              className="textarea textarea-bordered w-full"
              placeholder="Cancellation policy, what to prepare, meeting format, etc."
            />
            <p className="text-xs text-base-content/40 mt-1">
              Shown in a collapsible section on your booking page.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Tags (optional)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="input input-bordered w-full"
              placeholder="Product, Consulting, 1:1"
            />
            <p className="text-xs text-base-content/40 mt-1">
              Comma-separated, up to 6. Shown as small tags on your booking page.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Logo (optional)
            </label>
            <div className="flex items-center gap-3">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="w-12 h-12 rounded-full object-cover shrink-0"
                />
              )}
              <label className="btn btn-outline btn-sm">
                {isUploadingLogo ? "Processing…" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFile}
                  disabled={isUploadingLogo}
                  className="hidden"
                />
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl("")}
                  className="text-xs text-base-content/40 hover:text-error"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-base-content/40 mt-2">
              Or paste an image URL instead:
            </p>
            <input
              type="url"
              value={logoUrl.startsWith("data:") ? "" : logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="input input-bordered input-sm w-full mt-1"
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-base-content/40 mt-1">
              Leave blank to use your Google profile picture instead.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Accent color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-base-300 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="input input-bordered w-32 font-mono text-sm"
                pattern="#[0-9a-fA-F]{6}"
              />
            </div>
          </div>

          {/* Live preview */}
          <div>
            <p className="text-xs text-base-content/50 mb-2">Preview</p>
            <div className="rounded-xl border border-base-300 bg-base-200 p-5 text-center space-y-2">
              {displayLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayLogo}
                  alt={name}
                  className="w-12 h-12 rounded-full mx-auto object-cover"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: brandColor }}
                >
                  {name.charAt(0) || "?"}
                </div>
              )}
              <p className="font-bold">{name || "Your name"}</p>
              {title && <p className="text-xs text-base-content/50 -mt-1.5">{title}</p>}
              <p className="text-sm text-base-content/60">
                {welcomeMessage || bio || "Pick a time below."}
              </p>
              <button
                type="button"
                className="btn btn-sm mt-2"
                style={{ backgroundColor: brandColor, borderColor: brandColor, color: "white" }}
                disabled
              >
                30 Minute Meeting
              </button>
            </div>
          </div>
        </div>

        {result && (
          <p className={`text-sm ${result.type === "success" ? "text-success" : "text-error"}`}>
            {result.message}
          </p>
        )}

        <button type="submit" disabled={isSaving} className="btn btn-primary">
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
