"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DURATION_PRESETS = [15, 30, 45, 60];
const COLOR_PRESETS = ["#6366f1", "#ef4444", "#22c55e", "#f59e0b", "#0ea5e9", "#ec4899"];

export default function EventTypeForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [minimumNoticeHours, setMinimumNoticeHours] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/event-types", {
        method: "POST",
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create event type");
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
        </div>
      </details>

      {error && <p className="text-sm text-error">{error}</p>}

      <button type="submit" disabled={isSubmitting} className="btn btn-primary">
        {isSubmitting ? "Creating…" : "Create event type"}
      </button>
    </form>
  );
}
