"use client";

import { IncidentReplay } from "@/components/incident-replay";

import { useState } from "react";

type Status = "open" | "investigating" | "mitigating" | "resolved";

type IncidentEvent = {
  id: string;
  eventType: string;
  details: string | null;
  actorId: string | null;
  createdAt: string;
};

const nextStatus: Record<Status, Status> = {
  open: "investigating",
  investigating: "mitigating",
  mitigating: "resolved",
  resolved: "investigating",
};

export function IncidentTimeline({
  organizationId,
  incidentId,
  status,
  canUpdate,
  onUpdated,
}: {
  organizationId: string;
  incidentId: string;
  status: Status;
  canUpdate: boolean;
  onUpdated: (status: Status) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const endpoint =
    `/api/organizations/${organizationId}/incidents/${incidentId}`;

  async function loadHistory() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load incident.");
      }

      setEvents(data.events ?? []);
      onUpdated(data.incident.status);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load history."
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleHistory() {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);
    await loadHistory();
  }

  async function advanceStatus() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus[status],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update incident.");
      }

      onUpdated(data.incident.status);
      await loadHistory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Status update failed."
      );
    } finally {
      setSaving(false);
    }
  }

  function eventDescription(event: IncidentEvent) {
    if (!event.details) return event.eventType;

    try {
      const details = JSON.parse(event.details);

      if (event.eventType === "incident.status_changed") {
        return `Status changed: ${details.from} → ${details.to}`;
      }

      if (event.eventType === "incident.created") {
        return `Incident created — ${details.severity}`;
      }
    } catch {
      // Unrecognized event details are displayed by type only.
    }

    return event.eventType;
  }

  return (
    <div className="mt-5 border-t border-slate-700 pt-4">
      <button
        type="button"
        onClick={toggleHistory}
        aria-expanded={expanded}
        className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
      >
        {expanded ? "Hide timeline" : "View timeline"}
      </button>

      {expanded && (
        <div className="mt-5 space-y-4">
          {canUpdate && (
            <button
              type="button"
              onClick={advanceStatus}
              disabled={saving || loading}
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold capitalize text-slate-950 disabled:opacity-50"
            >
              {saving
                ? "Updating..."
                : `${status === "resolved" ? "Reopen" : "Move to"} ${nextStatus[status]}`}
            </button>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-slate-400">
              Loading timeline...
            </p>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-400">
              No history events available.
            </p>
          ) : (
            <ol className="space-y-4 border-l border-cyan-800 pl-5">
              {events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-cyan-400" />
                  <p className="text-sm font-medium text-slate-200">
                    {eventDescription(event)}
                  </p>
                  <time
                    dateTime={event.createdAt}
                    className="mt-1 block text-xs text-slate-500"
                  >
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          )}

          {events.length > 0 && (
            <IncidentReplay events={events} />
          )}
        </div>
      )}
    </div>
  );
}
