"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

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
  const [plan, setPlan] = useState(null);

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
        setPlan(data.plan || null);
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

      {/* Plan & Google Calendar sync status */}
      {plan && (
        <div className="rounded-xl border border-base-300 bg-base-200 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {plan.hasAccess ? "Pro plan" : "Free plan"}
              {!plan.hasAccess && (
                <span className="text-xs text-base-content/50 font-normal ml-1.5">
                  ({plan.eventTypeCount}/{plan.eventTypeLimit} event type
                  {plan.eventTypeLimit === 1 ? "" : "s"})
                </span>
              )}
            </p>
            {!plan.hasAccess && (
              <Link href="/#pricing" className="btn btn-primary btn-xs">
                Upgrade
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                plan.googleCalendarSyncActive
                  ? "bg-success"
                  : plan.googleCalendarConnected
                  ? "bg-warning"
                  : "bg-base-content/30"
              }`}
            />
            <span className="text-base-content/70">
              {plan.googleCalendarSyncActive
                ? "Google Calendar connected — two-way sync is on"
                : plan.googleCalendarConnected
                ? "Google Calendar connected, but sync is a Pro feature"
                : "Google Calendar not connected"}
            </span>
          </div>
          {!plan.googleCalendarConnected && (
            <button
              type="button"
              onClick={() =>
                signIn("google", { callbackUrl: window.location.pathname })
              }
              className="text-xs text-primary hover:underline inline-block"
            >
              Connect Google Calendar
            </button>
          )}
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
              Title (optional)
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
            <p className="text-xs text-base-content/40 mt-1">Your public booking link</p>
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
              placeholder="One line under your name"
            />
            <p className="text-xs text-base-content/40 mt-1 text-right">{bio.length}/280</p>
          </div>
        </div>

        {/* Branding */}
        <div className="space-y-5 pt-6 border-t border-base-300">
          <h3 className="font-semibold text-sm">Booking page branding</h3>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Welcome (optional)
            </label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={2}
              maxLength={300}
              className="textarea textarea-bordered w-full"
              placeholder="Short welcome on your page"
            />

          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-2">
              Social (optional)
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
              Notes (optional)
            </label>
            <textarea
              value={policyNotes}
              onChange={(e) => setPolicyNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              className="textarea textarea-bordered w-full"
              placeholder="e.g. cancel 24h ahead"
            />

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
            <p className="text-xs text-base-content/40 mt-1">Up to 6, comma-separated</p>
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
            <p className="text-xs text-base-content/40 mt-2">Square image works best. Or paste URL:</p>
            <input
              type="url"
              value={logoUrl.startsWith("data:") ? "" : logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="input input-bordered input-sm w-full mt-1"
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-base-content/40 mt-1">
              Blank = Google photo
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
