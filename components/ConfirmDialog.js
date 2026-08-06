"use client";

// 取代原生 confirm() 的通用確認彈窗。用法:
//
//   const [confirmState, setConfirmState] = useState(null);
//   ...
//   setConfirmState({
//     title: "Cancel this booking?",
//     description: "They'll be notified by email.",
//     confirmLabel: "Cancel booking",
//     danger: true,
//     onConfirm: () => doTheThing(),
//   });
//   ...
//   <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
export default function ConfirmDialog({ state, onClose }) {
  if (!state) return null;

  const {
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false,
    onConfirm,
  } = state;

  function handleConfirm() {
    onClose();
    onConfirm?.();
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

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm flex-1"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`btn btn-sm flex-1 ${danger ? "btn-error" : "btn-primary"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
