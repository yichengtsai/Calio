"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

function emptyRow() {
  return { email: "", name: "" };
}

export default function ClientPackagesManager() {
  const [packages, setPackages] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventTypeId, setEventTypeId] = useState("");
  const [totalSessions, setTotalSessions] = useState(10);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState([emptyRow(), emptyRow()]);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [pkgRes, etRes] = await Promise.all([
        fetch("/api/client-packages"),
        fetch("/api/event-types"),
      ]);
      const pkgData = await pkgRes.json();
      const etData = await etRes.json();
      setPackages(pkgData.packages || []);
      setEventTypes(etData.eventTypes || []);
      if (!eventTypeId && etData.eventTypes?.length) {
        setEventTypeId(etData.eventTypes[0].id || etData.eventTypes[0]._id);
      }
    } catch {
      toast.error("Failed to load packages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateRow(i, field, value) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(i) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function handleCreate(e) {
    e.preventDefault();
    const students = rows
      .map((r) => ({
        email: r.email.trim().toLowerCase(),
        name: r.name.trim() || undefined,
      }))
      .filter((r) => r.email);

    if (students.length === 0) {
      toast.error("Add at least one student email");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/client-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeId,
          totalSessions: Number(totalSessions),
          notes: notes || undefined,
          students,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create");
        return;
      }
      toast.success(
        data.count > 1
          ? `Created ${data.count} packages`
          : "Package created"
      );
      setRows([emptyRow(), emptyRow()]);
      setNotes("");
      setTotalSessions(10);
      load();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function adjust(id, delta) {
    const res = await fetch(`/api/client-packages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adjustRemaining: delta }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to update");
      return;
    }
    toast.success(delta > 0 ? "Added 1 session" : "Removed 1 session");
    load();
  }

  async function removePkg(id) {
    if (!confirm("Delete this package?")) return;
    const res = await fetch(`/api/client-packages/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Deleted");
    load();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold">Session packages</h1>
        <p className="text-base-content/60 text-sm mt-1">
          Fixed class counts per student email, bound to a course. Deducted when
          the appointment start time passes without cancellation.
        </p>
        <p className="text-xs text-base-content/40 mt-1">
          Page path: <code className="bg-base-300 px-1 rounded">/dashboard/packages</code>
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-base-300 bg-base-200 p-5 space-y-4"
      >
        <h2 className="font-bold">Activate packages</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-base-content/60">Course</label>
            <select
              className="select select-bordered select-sm w-full"
              value={eventTypeId}
              onChange={(e) => setEventTypeId(e.target.value)}
              required
            >
              {eventTypes.map((et) => (
                <option key={et.id || et._id} value={et.id || et._id}>
                  {et.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-base-content/60">
              Sessions each
            </label>
            <input
              type="number"
              min={1}
              className="input input-bordered input-sm w-full"
              value={totalSessions}
              onChange={(e) => setTotalSessions(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-base-content/60">
              Students (email + name)
            </label>
            <button type="button" className="btn btn-ghost btn-xs" onClick={addRow}>
              + Add row
            </button>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2 items-stretch">
              <input
                type="email"
                placeholder="email@example.com"
                className="input input-bordered input-sm flex-1"
                value={row.email}
                onChange={(e) => updateRow(i, "email", e.target.value)}
              />
              <input
                type="text"
                placeholder="Name (optional)"
                className="input input-bordered input-sm flex-1"
                value={row.name}
                onChange={(e) => updateRow(i, "name", e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm text-error"
                onClick={() => removeRow(i)}
                disabled={rows.length <= 1}
              >
                ✕
              </button>
            </div>
          ))}
          <p className="text-xs text-base-content/40">
            Empty rows are ignored. Same course + sessions applied to every
            filled email.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-base-content/60">Notes</label>
          <input
            type="text"
            className="input input-bordered input-sm w-full"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional note for all"
          />
        </div>

        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? "Saving…" : "Create packages"}
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="font-bold">All packages</h2>
        {loading ? (
          <p className="text-sm text-base-content/50">Loading…</p>
        ) : packages.length === 0 ? (
          <p className="text-sm text-base-content/50">No packages yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-medium">{p.inviteeName || "—"}</div>
                      <div className="text-xs text-base-content/50">{p.inviteeEmail}</div>
                    </td>
                    <td className="text-sm">{p.eventType?.title || "—"}</td>
                    <td>
                      <span className="font-semibold">{p.remainingSessions}</span>
                      <span className="text-base-content/40 text-xs">
                        {" "}
                        / {p.totalSessions}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-ghost badge-sm">{p.status}</span>
                    </td>
                    <td className="space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => adjust(p.id, 1)}
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => adjust(p.id, -1)}
                      >
                        −1
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => removePkg(p.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
