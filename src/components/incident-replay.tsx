"use client";

import { useState } from "react";

type Event = {
  id: string;
  eventType: string;
  details: string | null;
  createdAt: string;
};

const statuses = [
  "open",
  "investigating",
  "mitigating",
  "resolved",
] as const;

type Status = (typeof statuses)[number];

function isStatus(value: unknown): value is Status {
  return statuses.some((status) => status === value);
}

function parseDetails(value: string | null): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function IncidentReplay({ events }: { events: Event[] }) {
  const [step, setStep] = useState(0);

  // The caller supplies the events in chronological order.
  const frames: {
    id: string;
    at: string;
    eventType: string;
    status: Status | null;
    description: string;
  }[] = [];

  let currentStatus: Status | null = null;

  for (const event of events) {
    const details = parseDetails(event.details);

    if (event.eventType === "incident.created") {
      if (isStatus(details.status)) {
        currentStatus = details.status;
      } else {
        currentStatus = "open";
      }
    }

    if (event.eventType === "incident.status_changed") {
      if (isStatus(details.to)) {
        currentStatus = details.to;
      }
    }

    let description = event.eventType;

    if (event.eventType === "incident.created") {
      description = "Incident created";
    } else if (event.eventType === "incident.status_changed") {
      description = `Status changed to ${String(details.to ?? "unknown")}`;
    }

    frames.push({
      id: event.id,
      at: event.createdAt,
      eventType: event.eventType,
      status: currentStatus,
      description,
    });
  }

  if (!frames.length) {
    return null;
  }

  const selected = frames[Math.min(step, frames.length - 1)];
  const currentIndex = frames.indexOf(selected);

  return (
    <section className="mt-6 rounded-2xl border border-cyan-900 bg-[#0b1426] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-cyan-400">
            INCIDENT REPLAY
          </p>
          <h4 className="mt-2 text-lg font-semibold text-white">
            Reconstruct incident history
          </h4>
        </div>

        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
          Event {currentIndex + 1} of {frames.length}
        </span>
      </div>

      <p className="mt-4 text-sm text-slate-400">
        Select an event to inspect the recorded incident status at that point.
      </p>

      <input
        aria-label="Incident replay event"
        type="range"
        min={0}
        max={frames.length - 1}
        step={1}
        value={currentIndex}
        onChange={(event) => setStep(Number(event.target.value))}
        className="mt-6 w-full accent-cyan-400"
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setStep(currentIndex - 1)}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Previous
        </button>

        <button
          type="button"
          disabled={currentIndex === frames.length - 1}
          onClick={() => setStep(currentIndex + 1)}
          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
        >
          Next event
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900 p-5">
        <p className="text-xs text-slate-400">
          {new Date(selected.at).toLocaleString()}
        </p>

        <p className="mt-3 text-lg font-semibold text-white">
          {selected.description}
        </p>

        <p className="mt-3 text-sm text-slate-300">
          Reconstructed status:{" "}
          <span className="font-semibold capitalize text-cyan-300">
            {selected.status ?? "Unknown"}
          </span>
        </p>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Read-only replay based on stored events. This initial version
        reconstructs incident status, not every historical incident field.
      </p>
    </section>
  );
}
