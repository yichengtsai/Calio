"use client";

import { useEffect, useState } from "react";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const COMMON_TIMEZONES = [
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Australia/Sydney",
  "UTC",
];

function getTimezoneOptions() {
  try {
    const all = Intl.supportedValuesOf("timeZone");
    const rest = all.filter((tz) => !COMMON_TIMEZONES.includes(tz));
    return [...COMMON_TIMEZONES, ...rest];
  } catch {
    return COMMON_TIMEZONES;
  }
}

function emptyDayState() {
  return { enabled: false, ranges: [{ startTime: "09:00", endTime: "17:00" }] };
}

export default function AvailabilityForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Taipei");
  // days: { [dayOfWeek]: { enabled, ranges: [{startTime, endTime}] } }
  const [days, setDays] = useState({});
  const [result, setResult] = useState(null);

  const timezoneOptions = getTimezoneOptions();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/availability");
        const data = await res.json();

        setTimezone(data.timezone);

        const initial = {};
        DAYS.forEach((d) => {
          initial[d.value] = emptyDayState();
        });

        // 把同一天的多筆 timeSlots 分組成 ranges 陣列
        (data.timeSlots || []).forEach((slot) => {
          const existing = initial[slot.dayOfWeek];
          const range = { startTime: slot.startTime, endTime: slot.endTime };
          if (existing.enabled) {
            existing.ranges.push(range);
          } else {
            initial[slot.dayOfWeek] = { enabled: true, ranges: [range] };
          }
        });

        setDays(initial);
      } catch (e) {
        setResult({ type: "error", message: "Failed to load availability" });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function toggleDay(dayValue) {
    setDays((prev) => ({
      ...prev,
      [dayValue]: { ...prev[dayValue], enabled: !prev[dayValue]?.enabled },
    }));
  }

  function updateRange(dayValue, rangeIndex, field, value) {
    setDays((prev) => {
      const ranges = prev[dayValue].ranges.map((r, i) =>
        i === rangeIndex ? { ...r, [field]: value } : r
      );
      return { ...prev, [dayValue]: { ...prev[dayValue], ranges } };
    });
  }

  function addRange(dayValue) {
    setDays((prev) => {
      const last = prev[dayValue].ranges[prev[dayValue].ranges.length - 1];
      // 新的一段預設接在上一段結束時間之後,減少手動調整
      const nextStart = last?.endTime || "09:00";
      return {
        ...prev,
        [dayValue]: {
          ...prev[dayValue],
          ranges: [...prev[dayValue].ranges, { startTime: nextStart, endTime: "18:00" }],
        },
      };
    });
  }

  function removeRange(dayValue, rangeIndex) {
    setDays((prev) => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        ranges: prev[dayValue].ranges.filter((_, i) => i !== rangeIndex),
      },
    }));
  }

  function copyToAllDays(sourceDayValue) {
    const source = days[sourceDayValue];
    if (!source) return;
    setDays((prev) => {
      const next = { ...prev };
      DAYS.forEach((d) => {
        if (d.value !== sourceDayValue) {
          next[d.value] = {
            enabled: true,
            ranges: source.ranges.map((r) => ({ ...r })),
          };
        }
      });
      return next;
    });
  }

  async function handleSave() {
    setIsSaving(true);
    setResult(null);

    const timeSlots = [];
    for (const d of DAYS) {
      const day = days[d.value];
      if (!day?.enabled) continue;
      for (const r of day.ranges) {
        if (r.startTime >= r.endTime) {
          setResult({
            type: "error",
            message: `On ${d.label}, end time must be after start time`,
          });
          setIsSaving(false);
          return;
        }
        timeSlots.push({ dayOfWeek: d.value, startTime: r.startTime, endTime: r.endTime });
      }
    }

    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, timeSlots }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ type: "error", message: data.error || "Failed to save" });
        return;
      }

      setResult({ type: "success", message: "Availability saved" });
    } catch (e) {
      setResult({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-base-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const enabledCount = Object.values(days).filter((d) => d?.enabled).length;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Timezone card */}
      <div className="rounded-2xl border border-base-300 bg-base-200 p-5">
        <label className="block text-sm font-semibold mb-2">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="select select-bordered w-full max-w-xs"
        >
          {timezoneOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <p className="text-xs text-base-content/50 mt-2">
          All hours below are in this timezone.
        </p>
      </div>

      {/* Weekly hours card */}
      <div className="rounded-2xl border border-base-300 bg-base-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
          <div>
            <h3 className="font-semibold text-sm">Weekly hours</h3>
            <p className="text-xs text-base-content/50 mt-0.5">
              {enabledCount === 0
                ? "No days open yet"
                : `Open ${enabledCount} day${enabledCount === 1 ? "" : "s"} a week`}
            </p>
          </div>
        </div>

        <div className="divide-y divide-base-300">
          {DAYS.map((d) => {
            const day = days[d.value] || emptyDayState();
            return (
              <div
                key={d.value}
                className={`px-5 py-3.5 transition-colors ${day.enabled ? "" : "opacity-60"}`}
              >
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 w-32 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={() => toggleDay(d.value)}
                      className="toggle toggle-sm toggle-primary"
                    />
                    <span className="text-sm font-medium">{d.label}</span>
                  </label>

                  {day.enabled ? (
                    <div className="flex-1 space-y-2">
                      {day.ranges.map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={r.startTime}
                            onChange={(e) => updateRange(d.value, i, "startTime", e.target.value)}
                            className="input input-bordered input-sm w-[110px]"
                          />
                          <span className="text-base-content/40 text-sm">–</span>
                          <input
                            type="time"
                            value={r.endTime}
                            onChange={(e) => updateRange(d.value, i, "endTime", e.target.value)}
                            className="input input-bordered input-sm w-[110px]"
                          />
                          {day.ranges.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRange(d.value, i)}
                              className="text-base-content/30 hover:text-error px-1"
                              title="Remove this range"
                            >
                              ✕
                            </button>
                          )}
                          {i === 0 && (
                            <div className="ml-auto flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => addRange(d.value)}
                                className="btn btn-ghost btn-xs text-base-content/50 hover:text-primary"
                              >
                                + Add range
                              </button>
                              <button
                                type="button"
                                onClick={() => copyToAllDays(d.value)}
                                className="btn btn-ghost btn-xs text-base-content/40 hover:text-primary"
                              >
                                Copy to all
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-base-content/40">Unavailable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {result && (
        <div className={`alert ${result.type === "success" ? "alert-success" : "alert-error"} py-2.5`}>
          <span className="text-sm">{result.message}</span>
        </div>
      )}

      <button type="button" onClick={handleSave} disabled={isSaving} className="btn btn-primary px-8">
        {isSaving ? "Saving…" : "Save availability"}
      </button>
    </div>
  );
}
