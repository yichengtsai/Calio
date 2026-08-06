"use client";

import { useState } from "react";
import Link from "next/link";

export default function TodayScheduleList({ groups, timezone }) {
  const [selected, setSelected] = useState(null);

  const visibleGroups = groups.filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      {visibleGroups.map((group) => (
        <div key={group.label} className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-base-content/40">
            {group.label}
          </p>
          <div className="space-y-2">
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200 px-4 py-3 w-full text-left transition-colors hover:border-primary/50"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-xs text-base-content/50 truncate">{item.subtitle}</p>
                  )}
                </div>
                <span className="text-xs text-base-content/50 shrink-0">
                  {new Date(item.startTime).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: timezone,
                  })}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <Link
        href="/dashboard"
        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
      >
        View full calendar →
      </Link>

      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-opacity"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-base-100 border border-base-300 rounded-2xl max-w-sm w-full p-6 space-y-4 animate-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: selected.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg">{selected.title}</p>
                <p className="text-sm text-base-content/60 mt-0.5">
                  {new Date(selected.startTime).toLocaleString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: timezone,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-base-content/40 hover:text-base-content shrink-0"
              >
                ✕
              </button>
            </div>

            {selected.location && (
              <p className="text-sm">
                <span className="text-base-content/50">Location: </span>
                {selected.location}
              </p>
            )}

            {selected.source === "booking" && (
              <div className="rounded-lg bg-base-200 px-4 py-3 space-y-1">
                <p className="text-sm font-medium">{selected.inviteeName}</p>
                <p className="text-xs text-base-content/50">{selected.inviteeEmail}</p>
                {selected.inviteeNotes && (
                  <p className="text-xs text-base-content/60 italic mt-2">
                    &ldquo;{selected.inviteeNotes}&rdquo;
                  </p>
                )}
              </div>
            )}

            {selected.source === "event" && (
              <div className="space-y-1.5">
                {selected.description && (
                  <p className="text-sm text-base-content/70">{selected.description}</p>
                )}
                {selected.participants?.length > 0 && (
                  <div className="rounded-lg bg-base-200 px-4 py-3 space-y-1.5">
                    {selected.participants.map((p, i) => (
                      <p key={i} className="text-xs">
                        <span className="font-medium">{p.name || p.email}</span>
                        {p.name && <span className="text-base-content/40"> · {p.email}</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selected.source === "block" && selected.notes && (
              <p className="text-sm text-base-content/70">{selected.notes}</p>
            )}

            <Link
              href={
                selected.source === "booking"
                  ? "/dashboard/bookings"
                  : selected.source === "event"
                    ? "/dashboard/events"
                    : "/dashboard"
              }
              className="btn btn-outline btn-sm w-full"
            >
              Manage this
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
