"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DURATION_PRESETS = [15, 30, 45, 60];
const COLOR_PRESETS = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];
const REMINDER_PRESETS = [
  { label: "No reminder", value: 0 },
  { label: "10 minutes before", value: 10 },
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "1 day before", value: 1440 },
];
const LOCATION_TYPE_OPTIONS = [
  { value: "google_meet", label: "Google Meet (auto-create link)" },
  { value: "in_person", label: "In person" },
  { value: "phone", label: "Phone call" },
  { value: "custom", label: "Custom / other" },
];
const WINDOW_PRESETS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
  { label: "No limit", value: 0 },
];

export default function EventTypeForm({ eventTypeId }) {
  const router = useRouter();
  const isEditing = Boolean(eventTypeId);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState("");
  const [location, setLocation] = useState("");
  const [locationType, setLocationType] = useState("custom");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [requiresSessionPackage, setRequiresSessionPackage] = useState(false);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("TWD");
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(0); // 0 = same as duration
  const [minimumNoticeHours, setMinimumNoticeHours] = useState(0);
  const [bookingWindowDays, setBookingWindowDays] = useState(60);
  const [maxBookingsPerDay, setMaxBookingsPerDay] = useState(0);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

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
        setLocationType(
          et.locationType === "video" ? "google_meet" : et.locationType || "custom"
        );
        setColor(et.color || COLOR_PRESETS[0]);
        setRequiresApproval(et.requiresApproval !== false);
        setRequiresSessionPackage(Boolean(et.requiresSessionPackage));
        setPrice(et.price != null && et.price !== "" ? String(et.price) : "");
        setCurrency(et.currency || "TWD");
        setBufferMinutes(et.bufferMinutes || 0);
        setSlotIntervalMinutes(Number(et.slotIntervalMinutes) || 0);
        setMinimumNoticeHours((et.minimumNoticeMinutes || 0) / 60);
        setBookingWindowDays(
          et.bookingWindowDays === undefined ? 60 : et.bookingWindowDays
        );
        setMaxBookingsPerDay(et.maxBookingsPerDay || 0);
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
            locationType,
            color,
            requiresApproval,
            requiresSessionPackage,
            price: price === "" ? null : Number(price),
            currency,
            bufferMinutes,
            slotIntervalMinutes: Number(slotIntervalMinutes) || 0,
            minimumNoticeMinutes: minimumNoticeHours * 60,
            bookingWindowDays,
            maxBookingsPerDay,
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
        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
          className="input input-bordered w-full" placeholder="e.g. 30 Minute Consultation" />
      </div>
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">
          Session description / focus (visible to guests)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={2000}
          className="textarea textarea-bordered w-full"
          placeholder="e.g. Focus on lower-body strength and stability. Best for intermediate trainees. Wear training shoes; arrive 5 minutes early."
        />
        <p className="text-xs text-base-content/50 mt-1">
          Shown on the guest booking list and booking page. Include teaching focus, who it is for, and any notes.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Price (optional)</label>
          <input
            type="number"
            min={0}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input input-bordered w-full"
            placeholder="e.g. 1500"
          />
          <p className="text-xs text-base-content/50 mt-1">Shown on booking page. Leave empty to hide.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="select select-bordered w-full"
          >
            <option value="TWD">TWD</option>
            <option value="USD">USD</option>
            <option value="HKD">HKD</option>
            <option value="SGD">SGD</option>
            <option value="MYR">MYR</option>
            <option value="JPY">JPY</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-2">Duration</label>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((mins) => (
            <button key={mins} type="button"
              onClick={() => { setDuration(mins); setCustomDuration(""); }}
              className={`btn btn-sm ${duration === mins && !customDuration ? "btn-primary" : "btn-outline"}`}>
              {mins} min
            </button>
          ))}
          <input type="number" min={5} value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value)} placeholder="Custom"
            className="input input-bordered input-sm w-24" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">Location type</label>
        <select value={locationType} onChange={(e) => setLocationType(e.target.value)}
          className="select select-bordered w-full">
          {LOCATION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {locationType === "google_meet" && (
          <p className="text-xs text-base-content/50 mt-1">
            A Google Meet link is created automatically when the booking is confirmed (Pro + connected Google Calendar).
          </p>
        )}
      </div>
      {locationType !== "google_meet" && (
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">
            {locationType === "in_person" ? "Address (optional)"
              : locationType === "phone" ? "Phone number or note (optional)"
              : "Location / meeting link (optional)"}
          </label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
            className="input input-bordered w-full"
            placeholder={locationType === "in_person" ? "e.g. 123 Main St, Taipei"
              : locationType === "phone" ? "e.g. I'll call you" : "e.g. https://zoom.us/j/xxx"} />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-2">Color</label>
        <div className="flex gap-2">
          {COLOR_PRESETS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} style={{ backgroundColor: c }}
              className={`w-7 h-7 rounded-full transition-transform ${
                color === c ? "ring-2 ring-offset-2 ring-offset-base-100 ring-base-content scale-110" : ""
              }`} aria-label={`Choose color ${c}`} />
          ))}
          <label className="ml-1 flex items-center gap-1.5 text-xs text-base-content/50 cursor-pointer" title="Custom color">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-7 h-7 rounded-full border-0 p-0 cursor-pointer bg-transparent"
            />
            Custom
          </label>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-2">When someone books this</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRequiresApproval(true)}
            className={`btn btn-sm flex-1 ${requiresApproval ? "btn-primary" : "btn-outline"}`}>
            Needs your approval
          </button>
          <button type="button" onClick={() => setRequiresApproval(false)}
            className={`btn btn-sm flex-1 ${!requiresApproval ? "btn-primary" : "btn-outline"}`}>
            Auto-confirm
          </button>
        </div>
      </div>
      
      <div className="form-control">
        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={requiresSessionPackage}
            onChange={(e) => setRequiresSessionPackage(e.target.checked)}
          />
          <span className="label-text">
            Require session package (fixed class count)
          </span>
        </label>
        <p className="text-xs text-base-content/50 mt-1 ml-8">
          Guests must have remaining sessions for this course. A session is deducted when the start time passes without cancellation.
        </p>
      </div>

      <details className="rounded-lg border border-base-300 px-4 py-3" open>
        <summary className="text-sm font-medium cursor-pointer select-none">Availability rules</summary>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Buffer time between bookings</label>
            <select value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))}
              className="select select-bordered select-sm w-full max-w-[200px]">
              <option value={0}>No buffer</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
            <p className="text-xs text-base-content/50 mt-1">
              Padding before and after this booking so it won&apos;t sit flush against another booking or meeting.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              Start-time interval
            </label>
            <select
              value={String(slotIntervalMinutes)}
              onChange={(e) => setSlotIntervalMinutes(Number(e.target.value))}
              className="select select-bordered select-sm w-full max-w-[200px]"
            >
              <option value="0">Same as duration (default)</option>
              <option value="5">Every 5 minutes</option>
              <option value="10">Every 10 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 60 minutes</option>
            </select>
            <p className="text-xs text-base-content/50 mt-1">
              Gap between possible start times (e.g. every 15 min → 10:00, 10:15, 10:30). Each start still needs the full duration free inside your hours, and won&apos;t overlap other bookings/meetings including buffer.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Minimum notice</label>
            <select value={minimumNoticeHours} onChange={(e) => setMinimumNoticeHours(Number(e.target.value))}
              className="select select-bordered select-sm w-full max-w-[200px]">
              <option value={0}>No minimum</option>
              <option value={1}>1 hour</option>
              <option value={4}>4 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>2 days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">How far ahead can people book</label>
            <select value={bookingWindowDays} onChange={(e) => setBookingWindowDays(Number(e.target.value))}
              className="select select-bordered select-sm w-full max-w-[200px]">
              {WINDOW_PRESETS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Max bookings per day</label>
            <select value={maxBookingsPerDay} onChange={(e) => setMaxBookingsPerDay(Number(e.target.value))}
              className="select select-bordered select-sm w-full max-w-[200px]">
              <option value={0}>No limit</option>
              {[1,2,3,4,5,8,10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Email reminder</label>
            <select value={reminderMinutesBefore} onChange={(e) => setReminderMinutesBefore(Number(e.target.value))}
              className="select select-bordered select-sm w-full max-w-[200px]">
              {REMINDER_PRESETS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </details>
      {error && <p className="text-sm text-error">{error}</p>}
      <button type="submit" disabled={isSubmitting} className="btn btn-primary">
        {isSubmitting ? (isEditing ? "Saving…" : "Creating…") : isEditing ? "Save changes" : "Create event type"}
      </button>
    </form>
  );
}
