"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog";

export default function EventTypeList() {
  const [eventTypes, setEventTypes] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [username, setUsername] = useState(null);
  const [sharingId, setSharingId] = useState(null); // 哪一列的分享/QR 彈窗開著
  const [plan, setPlan] = useState(null);

  async function load() {
    try {
      const res = await fetch("/api/event-types");
      const data = await res.json();
      setEventTypes(data.eventTypes || []);
    } catch (e) {
      setError("Failed to load event types");
    }
  }

  useEffect(() => {
    load();
    // 分享連結需要知道自己的 username,才能組出 /{username}/{slug} 的公開網址;
    // 順便拿一下方案資訊,免費版滿額時要顯示升級提示。
    fetch("/api/account")
      .then((res) => res.json())
      .then((data) => {
        setUsername(data.username || null);
        setPlan(data.plan || null);
      })
      .catch(() => setUsername(null));
  }, []);

  async function toggleActive(eventType) {
    setBusyId(eventType.id);
    try {
      await fetch(`/api/event-types/${eventType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !eventType.isActive }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function handleDelete(eventType) {
    setConfirmState({
      title: `Delete "${eventType.title}"?`,
      description: "This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => doDelete(eventType),
    });
  }

  async function doDelete(eventType) {
    setBusyId(eventType.id);
    try {
      await fetch(`/api/event-types/${eventType.id}`, { method: "DELETE" });
      toast.success("Deleted");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function bookingUrl(slug) {
    if (!username || typeof window === "undefined") return null;
    return `${window.location.origin}/${username}/${slug}`;
  }

  async function handleCopyLink(slug) {
    const url = bookingUrl(slug);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch (e) {
      toast.error("Couldn't copy — copy it manually from the box below");
    }
  }

  if (error) {
    return <p className="text-sm text-error">{error}</p>;
  }

  if (eventTypes === null) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-base-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const atFreeLimit =
    plan && !plan.hasAccess && plan.eventTypeLimit !== null && plan.eventTypeCount >= plan.eventTypeLimit;

  const limitBanner = atFreeLimit ? (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-sm text-base-content/70">
        You&apos;ve used {plan.eventTypeCount}/{plan.eventTypeLimit} event type on the Free plan.
      </p>
      <Link href="/#pricing" className="btn btn-primary btn-xs shrink-0">
        Upgrade for unlimited
      </Link>
    </div>
  ) : null;

  if (eventTypes.length === 0) {
    return (
      <div className="space-y-4">
        {limitBanner}
        <div className="rounded-2xl border border-dashed border-base-300 p-10 text-center">
          <p className="text-base-content/60 mb-4">You haven&apos;t created any event types yet.</p>
          <Link href="/dashboard/event-types/new" className="btn btn-primary btn-sm">
            Create your first event type
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {limitBanner}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-base-content/55">
          {eventTypes.length} event type{eventTypes.length === 1 ? "" : "s"}
        </p>
        {atFreeLimit ? (
          <Link href="/#pricing" className="btn btn-primary btn-sm">
            Upgrade to add more
          </Link>
        ) : (
          <Link href="/dashboard/event-types/new" className="btn btn-primary btn-sm">
            + New event type
          </Link>
        )}
      </div>
      {eventTypes.map((et) => {
        const url = bookingUrl(et.slug);
        const isSharing = sharingId === et.id;

        return (
          <div
            key={et.id}
            className={`rounded-xl border border-base-300 bg-base-200 px-5 py-4 transition-opacity ${
              et.isActive ? "" : "opacity-50"
            }`}
          >
            <div className="flex items-center gap-4">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: et.color }}
              />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{et.title}</p>
                <p className="text-xs text-base-content/50">
                  {et.duration} min{et.location ? ` · ${et.location}` : ""} ·{" "}
                  {et.requiresApproval ? "Needs approval" : "Auto-confirm"}
                </p>
              </div>

              <input
                type="checkbox"
                checked={et.isActive}
                onChange={() => toggleActive(et)}
                disabled={busyId === et.id}
                className="toggle toggle-sm toggle-primary"
              />

              <button
                type="button"
                onClick={() => setSharingId(isSharing ? null : et.id)}
                disabled={!url}
                className="btn btn-ghost btn-xs text-base-content/60"
              >
                Share
              </button>

              <Link
                href={`/dashboard/event-types/${et.id}/edit`}
                className="btn btn-ghost btn-xs text-base-content/60"
              >
                Edit
              </Link>

              <button
                type="button"
                onClick={() => handleDelete(et)}
                disabled={busyId === et.id}
                className="btn btn-ghost btn-xs text-base-content/40 hover:text-error"
              >
                Delete
              </button>
            </div>

            {isSharing && url && (
              <div className="mt-3 pt-3 border-t border-base-300/60 flex items-center gap-4">
                {/* 用免費的 QR code 產圖服務,不用額外裝套件;圖片內容只是這個公開頁面的網址,沒有任何隱私資料 */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                    url
                  )}`}
                  alt={`QR code for ${et.title}`}
                  width={96}
                  height={96}
                  className="rounded-lg border border-base-300 bg-base-100 shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.target.select()}
                    className="input input-bordered input-sm w-full text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(et.slug)}
                      className="btn btn-primary btn-xs"
                    >
                      Copy link
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-xs"
                    >
                      Open page
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
