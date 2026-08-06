"use client";

import { useState } from "react";

const COLOR_PRESETS = ["#0ea5e9", "#6366f1", "#ef4444", "#22c55e", "#f59e0b", "#ec4899"];

export default function CreateEventForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [participants, setParticipants] = useState([{ email: "", name: "" }]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { type: "success" | "error", message }
  const [conflicts, setConflicts] = useState(null); // Google Calendar 衝突時間列表

  function updateParticipant(index, field, value) {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function addParticipant() {
    setParticipants((prev) => [...prev, { email: "", name: "" }]);
  }

  function removeParticipant(index) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitEvent({ ignoreConflicts } = {}) {
    const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
    const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: location || undefined,
        meetingUrl: meetingUrl || undefined,
        color,
        participants: participants.filter((p) => p.email.trim() !== ""),
        ignoreConflicts,
      }),
    });

    return { res, data: await res.json() };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    setConflicts(null);

    try {
      const { res, data } = await submitEvent();

      if (res.status === 409) {
        // Google Calendar 上這段時間已經有其他行程,先讓使用者確認要不要照樣建立
        setConflicts(data.conflicts || []);
        return;
      }

      if (!res.ok) {
        setResult({ type: "error", message: data.error || "Failed to create the event" });
        return;
      }

      handleSuccess(data);
    } catch (err) {
      setResult({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateAnyway() {
    setIsSubmitting(true);
    try {
      const { res, data } = await submitEvent({ ignoreConflicts: true });
      if (!res.ok) {
        setResult({ type: "error", message: data.error || "Failed to create the event" });
        return;
      }
      handleSuccess(data);
    } catch (err) {
      setResult({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSuccess(data) {
    setConflicts(null);
    setResult({
      type: "success",
      message: `Event created — ${data.emailsSent} invite${data.emailsSent === 1 ? "" : "s"} sent${
        data.emailsFailed > 0 ? `, ${data.emailsFailed} failed to send` : ""
      }${data.syncedToGoogleCalendar ? ", synced to Google Calendar" : ""}`,
    });

    setTitle("");
    setDescription("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setLocation("");
    setMeetingUrl("");
    setColor(COLOR_PRESETS[0]);
    setParticipants([{ email: "", name: "" }]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">Event title</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input input-bordered w-full"
          placeholder="e.g. Product weekly sync"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="textarea textarea-bordered w-full"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input input-bordered w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Start</label>
          <input
            type="time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="input input-bordered w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">End</label>
          <input
            type="time"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="input input-bordered w-full"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">Location (optional)</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="input input-bordered w-full"
          placeholder="e.g. HQ, 3rd floor meeting room"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-1">Meeting link (optional)</label>
        <input
          type="url"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          className="input input-bordered w-full"
          placeholder="https://meet.google.com/xxx-xxxx-xxx"
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
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-base-content/80">Participants</label>
          <button type="button" onClick={addParticipant} className="text-sm text-primary underline">
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {participants.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="email"
                placeholder="email"
                value={p.email}
                onChange={(e) => updateParticipant(i, "email", e.target.value)}
                className="input input-bordered flex-1"
              />
              <input
                type="text"
                placeholder="name (optional)"
                value={p.name}
                onChange={(e) => updateParticipant(i, "name", e.target.value)}
                className="input input-bordered w-32"
              />
              {participants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeParticipant(i)}
                  className="text-base-content/40 hover:text-error px-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {conflicts && (
        <div className="alert alert-warning flex-col items-start gap-2">
          <p className="font-semibold text-sm">
            This overlaps with {conflicts.length} event{conflicts.length === 1 ? "" : "s"} on your Google Calendar
          </p>
          <ul className="text-sm space-y-1">
            {conflicts.map((c, i) => (
              <li key={i}>
                {new Date(c.start).toLocaleString()} – {new Date(c.end).toLocaleString()}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleCreateAnyway}
            disabled={isSubmitting}
            className="btn btn-sm btn-outline mt-1"
          >
            Create anyway
          </button>
        </div>
      )}

      {result && (
        <p className={`text-sm ${result.type === "success" ? "text-success" : "text-error"}`}>
          {result.message}
        </p>
      )}

      <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
        {isSubmitting ? "Creating…" : "Create event and send invites"}
      </button>
    </form>
  );
}
