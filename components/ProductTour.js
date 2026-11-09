"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/**
 * Interactive product tour — stays on /dashboard only (no route jumps).
 */
export const TOUR_STEPS = [
  // —— Left sidebar ——
  {
    id: "nav-calendar",
    title: "Calendar（工作區）",
    body: "主工作區：日曆、預約列表與活動類型都在這裡切換。大多數日常操作從這裡開始。",
  },
  {
    id: "packages",
    title: "Packages（方案）",
    body: "為客戶啟用堂數方案：選擇課程、填入 email 與堂數。剩餘堂數會在他們預約時自動檢查。",
  },
  {
    id: "insights",
    title: "Insights（洞察）",
    body: "查看時間怎麼被使用：預約趨勢、熱門活動類型、回覆率等，幫你優化可約時段。",
  },
  {
    id: "settings",
    title: "Settings（設定）",
    body: "設定公開頁 username、品牌色、logo、歡迎文字與社群連結。客戶看到的預約頁從這裡客製。",
  },
  {
    id: "tour-btn",
    title: "Take a tour",
    body: "隨時可以再點這裡重看導覽。導覽不會改動你的資料。",
  },
  // —— Workspace tools (still on /dashboard) ——
  {
    id: "availability",
    title: "Weekly hours",
    body: "設定每週可預約時段。客戶只能在這些時段內選時間。",
  },
  {
    id: "event-types",
    title: "Event types",
    body: "建立會議／課程（時長、緩衝、地點）。若需堂數方案，請開啟 requires session package。",
  },
  {
    id: "bookings",
    title: "Bookings",
    body: "查看待審核、即將到來與過去的預約；可核准或拒絕請求。",
  },
  {
    id: "calendar",
    title: "日曆主畫面",
    body: "一覽本週行程。可在格線上拖曳標忙碌；淡色區塊為可預約空檔。",
  },
  {
    id: "add",
    title: "+ Add",
    body: "新增會議（可寄信邀請）或標記個人忙碌，避免被預約佔用。",
  },
];

const STORAGE_KEY = "calio-tour-done";

export function isTourDone() {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTourDone() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

function measureTarget(id) {
  const el = document.querySelector(`[data-tour="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  const pad = 8;
  return {
    top: Math.max(0, r.top - pad),
    left: Math.max(0, r.left - pad),
    width: r.width + pad * 2,
    height: r.height + pad * 2,
    el,
  };
}

export default function ProductTour({ open, onClose }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  // Reset to step 0 *before paint* whenever the tour opens — avoids flash of last step
  useLayoutEffect(() => {
    if (open) {
      setIndex(0);
      setRect(null);
    }
  }, [open]);

  const step = open ? TOUR_STEPS[index] : null;
  const total = TOUR_STEPS.length;

  const refreshRect = useCallback(() => {
    if (!step) {
      setRect(null);
      return;
    }
    const m = measureTarget(step.id);
    setRect(m);
    if (m?.el) {
      m.el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [step]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const t = requestAnimationFrame(() => refreshRect());
    return () => cancelAnimationFrame(t);
  }, [open, index, step, refreshRect]);

  useEffect(() => {
    if (!open) return;
    function onResize() {
      refreshRect();
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, refreshRect]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  function finish() {
    markTourDone();
    setIndex(0);
    setRect(null);
    onClose?.();
  }

  function goNext() {
    setIndex((i) => {
      if (i >= total - 1) {
        // defer finish so we don't setState during render of updater
        queueMicrotask(() => finish());
        return i;
      }
      return i + 1;
    });
  }

  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  if (!open || !step) return null;

  const tipStyle = (() => {
    if (!rect) {
      return {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10001,
      };
    }
    const tipW = 320;
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const placeBelow = spaceBelow > 180;
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12));
    const top = placeBelow
      ? rect.top + rect.height + 12
      : Math.max(12, rect.top - 12 - 160);
    return {
      position: "fixed",
      left,
      top,
      width: tipW,
      zIndex: 10001,
    };
  })();

  return (
    <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10000 }}>
        <defs>
          <mask id="calio-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.55)"
          mask="url(#calio-tour-mask)"
        />
      </svg>

      <div className="absolute inset-0" style={{ zIndex: 10000 }} onClick={finish} />

      {rect && (
        <div
          className="pointer-events-none rounded-[10px]"
          style={{
            position: "fixed",
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            zIndex: 10001,
            boxShadow:
              "0 0 0 2px rgba(99,102,241,0.95), 0 8px 24px rgba(99,102,241,0.28)",
          }}
        />
      )}

      <div
        className="rounded-2xl border border-base-300 bg-base-100 shadow-2xl p-4 space-y-3 animate-popup"
        style={tipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">
              {index + 1} / {total}
            </p>
            <h3 className="font-bold text-base mt-0.5">{step.title}</h3>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs text-base-content/50"
            onClick={finish}
          >
            Skip
          </button>
        </div>
        <p className="text-sm text-base-content/65 leading-relaxed">{step.body}</p>
        {!rect && (
          <p className="text-xs text-warning">
            This control isn’t visible — use Next to continue.
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={goPrev}
            disabled={index === 0}
          >
            ← Prev
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={goNext}>
            {index >= total - 1 ? "Done" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
