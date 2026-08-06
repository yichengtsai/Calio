"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DURATION_PRESETS = [15, 30, 45, 60];
const COLOR_PRESETS = ["#6366f1", "#ef4444", "#22c55e", "#f59e0b", "#0ea5e9", "#ec4899"];
const REMINDER_PRESETS = [
  { label: "No reminder", value: 0 },
  { label: "10 minutes before", value: 10 },
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "1 day before", value: 1440 },
];

// eventTypeId 有帶值 = 編輯既有的活動類型;沒帶 = 建立新的(原本的行為)
export default function EventTypeForm({ eventTypeId }) {
  const router = useRouter();
  const isEditing = Boolean(eventTypeId);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [minimumNoticeHours, setMinimumNoticeHours] = useState(0);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(30);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // 編輯模式:先把現有資料抓回來灌進表單
  useEffect(() => {
    if (!isEditing) return;

    async function load() {
      try {
        const res = await fetch(`/api/event-types/${eventTypeId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to load event type");
          return;
        }
        const et = data.eventType;
        setTitle(et.title || "");
        setDescription(et.description || "");
        if (DURATION_PRESETS.includes(et.duration)) {
          setDuration(et.duration);
        } else {
          setCustomDuration(String(et.duration));
        }
        setLocation(et.location || "");
        setColor(et.color || COLOR_PRESETS[0]);
        setRequiresApproval(et.requiresApproval !== false);
        setBufferMinutes(et.bufferMinutes || 0);
        setMinimumNoticeHours((et.minimumNoticeMinutes || 0) / 60);
        setReminderMinutesBefore(
          et.reminderMinutesBefore === undefined ? 30 : et.reminderMinutesBefore
        );
      } catch (e) {
        setError("Failed to load event type");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [isEditing, eventTypeId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        isEditing ? `/api/event-types/${eventTypeId}` : "/api/event-types",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || undefined,
            duration: customDuration || duration,
            location: location || undefined,
            color,
            requiresApproval,
            bufferMinutes,
            minimumNoticeMinutes: minimumNoticeHours * 60,
            reminderMinutesBefore,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Failed to ${isEditing ? "save" : "create"} event type`);
        return;
      }

      router.push("/dashboard/event-types");
      router.refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-lg space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-base-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">Name</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input input-bordered w-full"
          placeholder="e.g. 30 Minute Consultation"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="textarea textarea-bordered w-full"
          placeholder="What's this meeting about?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-2">Duration</label>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => {
                setDuration(mins);
                setCustomDuration("");
              }}
              className={`btn btn-sm ${
                duration === mins && !customDuration ? "btn-primary" : "btn-outline"
              }`}
            >
              {mins} min
            </button>
          ))}
          <input
            type="number"
            min={5}
            value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value)}
            placeholder="Custom"
            className="input input-bordered input-sm w-24"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Location / meeting link (optional)
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="input input-bordered w-full"
          placeholder="e.g. https://meet.google.com/xxx-xxxx-xxx, or an address"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-2">Color</label>
        <div className="flex gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-7 h-7 rounded-full transition-transform ${
                color === c ? "ring-2 ring-offset-2 ring-offset-base-100 ring-base-content scale-110" : ""
              }`}
              aria-label={`Choose color ${c}`}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-2">
          When someone books this
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRequiresApproval(true)}
            className={`btn btn-sm flex-1 ${requiresApproval ? "btn-primary" : "btn-outline"}`}
          >
            Needs your approval
          </button>
          <button
            type="button"
            onClick={() => setRequiresApproval(false)}
            className={`btn btn-sm flex-1 ${!requiresApproval ? "btn-primary" : "btn-outline"}`}
          >
            Auto-confirm
          </button>
        </div>
        <p className="text-xs text-base-content/50 mt-1">
          {requiresApproval
            ? "Bookings sit as pending until you approve them."
            : "Bookings are confirmed instantly, no approval needed."}
        </p>
      </div>

      <details className="rounded-lg border border-base-300 px-4 py-3">
        <summary className="text-sm font-medium cursor-pointer select-none">
          Advanced
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Buffer time between bookings
            </label>
            <select
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Number(e.target.value))}
              className="select select-bordered select-sm w-full max-w-[200px]"
            >
              <option value={0}>No buffer</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
            <p className="text-xs text-base-content/40 mt-1">
              Leaves gap time before and after this event on your calendar.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Minimum notice
            </label>
            <select
              value={minimumNoticeHours}
              onChange={(e) => setMinimumNoticeHours(Number(e.target.value))}
              className="select select-bordered select-sm w-full max-w-[200px]"
            >
              <option value={0}>No minimum</option>
              <option value={1}>1 hour</option>
              <option value={4}>4 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>2 days</option>
            </select>
            <p className="text-xs text-base-content/40 mt-1">
              How far in advance people must book — no last-minute requests.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Email reminder
            </label>
            <select
              value={reminderMinutesBefore}
              onChange={(e) => setReminderMinutesBefore(Number(e.target.value))}
              className="select select-bordered select-sm w-full max-w-[200px]"
            >
              {REMINDER_PRESETS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-base-content/40 mt-1">
              Sends both people an email before confirmed bookings of this type start.
            </p>
          </div>
        </div>
      </details>

      {error && <p className="text-sm text-error">{error}</p>}

      <button type="submit" disabled={isSubmitting} className="btn btn-primary">
        {isSubmitting
          ? isEditing
            ? "Saving…"
            : "Creating…"
          : isEditing
          ? "Save changes"
          : "Create event type"}
      </button>
    </form>
  );
}
