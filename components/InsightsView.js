"use client";

import { useEffect, useState } from "react";

function formatMinutes(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function InsightsView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/insights")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load insights");
        setData(body);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-error">{error}</p>;

  if (!data) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-base-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const maxTrendCount = Math.max(1, ...data.monthlyTrend.map((m) => m.count));
  const maxWeekdayCount = Math.max(1, ...data.weekdayCounts.map((d) => d.count));
  const maxRankingCount = Math.max(1, ...data.eventTypeRanking.map((r) => r.count));

  return (
    <div className="space-y-6">
      {/* 摘要卡片 */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-base-300 bg-base-200 px-5 py-4">
          <p className="text-xs text-base-content/50">This month</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-3xl font-bold">{data.thisMonth.count}</p>
            <span className="text-sm text-base-content/40">meetings</span>
          </div>
          <p className="text-xs text-base-content/50 mt-1">
            {data.thisMonth.hours}h total
            {data.momChangePct !== null && (
              <span className={data.momChangePct >= 0 ? "text-success" : "text-error"}>
                {" "}
                · {data.momChangePct >= 0 ? "+" : ""}
                {data.momChangePct}% vs last month
              </span>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-base-300 bg-base-200 px-5 py-4">
          <p className="text-xs text-base-content/50">Cancellation rate</p>
          <p className="text-3xl font-bold mt-1">
            {data.cancellationRate !== null ? `${data.cancellationRate}%` : "—"}
          </p>
          <p className="text-xs text-base-content/50 mt-1">
            {data.cancellationRate !== null
              ? "of resolved bookings, last 90 days"
              : "Not enough data yet"}
          </p>
        </div>

        <div className="rounded-2xl border border-base-300 bg-base-200 px-5 py-4">
          <p className="text-xs text-base-content/50">Avg. response time</p>
          <p className="text-3xl font-bold mt-1">
            {data.avgResponseMinutes !== null ? formatMinutes(data.avgResponseMinutes) : "—"}
          </p>
          <p className="text-xs text-base-content/50 mt-1">
            {data.avgResponseMinutes !== null
              ? "to approve or decline, last 90 days"
              : "No approvals recorded yet"}
          </p>
        </div>
      </div>

      {/* 月趨勢 */}
      <div className="rounded-2xl border border-base-300 bg-base-200 p-5">
        <p className="text-sm font-semibold mb-4">Meetings per month</p>
        <div className="flex items-end justify-between gap-2 h-36">
          {data.monthlyTrend.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[11px] text-base-content/50">{m.count || ""}</span>
              <div
                className="w-full max-w-[36px] rounded-t-md bg-primary/70"
                style={{
                  height: `${Math.max(4, (m.count / maxTrendCount) * 96)}px`,
                }}
              />
              <span className="text-[11px] text-base-content/50">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Event Type 排名 */}
        <div className="rounded-2xl border border-base-300 bg-base-200 p-5">
          <p className="text-sm font-semibold mb-4">Most booked event types</p>
          {data.eventTypeRanking.length === 0 ? (
            <p className="text-sm text-base-content/50">No confirmed bookings yet</p>
          ) : (
            <div className="space-y-3">
              {data.eventTypeRanking.map((r) => (
                <div key={r.title}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium truncate">{r.title}</span>
                    <span className="text-base-content/50 shrink-0 ml-2">{r.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-base-300 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (r.count / maxRankingCount) * 100)}%`,
                        backgroundColor: r.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 星期分布 */}
        <div className="rounded-2xl border border-base-300 bg-base-200 p-5">
          <p className="text-sm font-semibold mb-1">Busiest day of the week</p>
          <p className="text-xs text-base-content/50 mb-4">
            {data.busiestWeekday
              ? `Most bookings land on ${data.busiestWeekday}s`
              : "Not enough data yet"}
          </p>
          <div className="flex items-end justify-between gap-2 h-24">
            {data.weekdayCounts.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={`w-full max-w-[28px] rounded-t-md ${
                    d.label === data.busiestWeekday ? "bg-primary" : "bg-primary/30"
                  }`}
                  style={{
                    height: `${Math.max(4, (d.count / maxWeekdayCount) * 64)}px`,
                  }}
                />
                <span className="text-[11px] text-base-content/50">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
