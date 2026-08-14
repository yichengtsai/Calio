"use client";

import { useState, useEffect } from "react";

// 取代原生 confirm() 的通用確認彈窗。
// 可選 reasonField: { label, placeholder, optional } → 確認時把 reason 傳給 onConfirm(reason)
export default function ConfirmDialog({ state, onClose }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setReason("");
    setSubmitting(false);
  }, [state]);

  if (!state) return null;

  const {
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false,
    onConfirm,
    reasonField,
  } = state;

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      // 先關彈窗，讓列表可以立刻更新（optimistic UI）
      onClose();
      await onConfirm?.(reasonField ? reason.trim() : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-opacity"
      onClick={onClose}
    >
      <div
        className="bg-base-100 border border-base-300 rounded-2xl max-w-sm w-full p-6 space-y-4 animate-popup"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="font-bold text-lg">{title}</p>
          {description && (
            <p className="text-sm text-base-content/60 mt-1">{description}</p>
          )}
        </div>

        {reasonField && (
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              {reasonField.label || "Reason"}
              {reasonField.optional !== false && (
                <span className="text-base-content/40 font-normal"> (optional)</span>
              )}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={reasonField.placeholder || ""}
              className="textarea textarea-bordered w-full text-sm"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn btn-ghost btn-sm flex-1"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`btn btn-sm flex-1 ${danger ? "btn-error" : "btn-primary"}`}
          >
            {submitting ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
