"use client";

import { IncidentTimeline } from "@/components/incident-timeline";
import { FormEvent, useEffect, useState } from "react";

type Organization = {
  id: string;
  name: string;
  role: "owner" | "admin" | "responder" | "viewer";
};

type Incident = {
  id: string;
  title: string;
  description: string | null;
  severity: "SEV1" | "SEV2" | "SEV3" | "SEV4";
  status: "open" | "investigating" | "mitigating" | "resolved";
  createdAt: string;
};

const severityStyles: Record<Incident["severity"], string> = {
  SEV1: "bg-red-500/15 text-red-300",
  SEV2: "bg-orange-500/15 text-orange-300",
  SEV3: "bg-amber-500/15 text-amber-300",
  SEV4: "bg-blue-500/15 text-blue-300",
};

export function IncidentManager() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Incident["severity"]>("SEV3");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrganizations() {
      try {
        const response = await fetch("/api/organizations", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Cannot load organizations.");

        const data = await response.json();
        const items: Organization[] = data.organizations ?? [];
        setOrganizations(items);
        setOrganizationId((current) => current || items[0]?.id || "");
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load your organizations.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadOrganizations();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setIncidents([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    setIncidents([]);

    async function loadIncidents() {
      try {
        const response = await fetch(
          `/api/organizations/${organizationId}/incidents`,
          { cache: "no-store", signal: controller.signal }
        );

        if (!response.ok) throw new Error("Cannot load incidents.");

        const data = await response.json();
        setIncidents(data.incidents ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to retrieve incidents.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadIncidents();
    return () => controller.abort();
  }, [organizationId]);

  async function createIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/incidents`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            severity,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to create incident.");
      }

      setIncidents((current) => [data.incident, ...current].slice(0, 50));
      setTitle("");
      setDescription("");
      setSeverity("SEV3");
      setSuccess("Incident created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setSaving(false);
    }
  }

  const canCreate = organizations.some(
    (org) =>
      org.id === organizationId &&
      ["owner", "admin", "responder"].includes(org.role)
  );

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-cyan-400">
            INCIDENT OPERATIONS
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Incident management</h2>
          <p className="mt-2 text-sm text-slate-400">
            Track operational disruptions and their severity.
          </p>
        </div>

        <select
          aria-label="Select organization"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white"
        >
          {!organizationId && <option value="">Select workspace</option>}
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-7">
          <h3 className="text-xl font-semibold">Report an incident</h3>

          {!canCreate ? (
            <p className="mt-4 text-sm text-slate-400">
              Select an organization where you have permission to create incidents.
            </p>
          ) : (
            <form onSubmit={createIncident} className="mt-6 space-y-5">
              <label className="block text-sm text-slate-300">
                Incident title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  minLength={3}
                  maxLength={240}
                  placeholder="Payment API latency spike"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
              </label>

              <label className="block text-sm text-slate-300">
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={5000}
                  rows={4}
                  placeholder="Describe the symptoms and affected systems..."
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
              </label>

              <label className="block text-sm text-slate-300">
                Severity
                <select
                  value={severity}
                  onChange={(event) =>
                    setSeverity(event.target.value as Incident["severity"])
                  }
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                >
                  <option value="SEV1">SEV1 — Critical</option>
                  <option value="SEV2">SEV2 — High</option>
                  <option value="SEV3">SEV3 — Medium</option>
                  <option value="SEV4">SEV4 — Low</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {saving ? "Creating incident..." : "Create incident"}
              </button>
            </form>
          )}

          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-red-950 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="mt-5 rounded-xl bg-emerald-950 p-3 text-sm text-emerald-300">
              {success}
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-7">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Recent incidents</h3>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
              {incidents.length} shown
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-400">Loading incidents...</p>
            ) : incidents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                No incidents yet. Report your first incident.
              </div>
            ) : (
              incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded-xl border border-slate-700 bg-slate-900 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h4 className="font-semibold">{incident.title}</h4>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${severityStyles[incident.severity]}`}>
                      {incident.severity}
                    </span>
                  </div>

                  {incident.description && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-400">
                      {incident.description}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                    <span className="capitalize">
                      Status: {incident.status}
                    </span>
                    <time dateTime={incident.createdAt}>
                      {new Date(incident.createdAt).toLocaleString()}
                    </time>
                  </div>

                  <IncidentTimeline
                    organizationId={organizationId}
                    incidentId={incident.id}
                    status={incident.status}
                    canUpdate={canCreate}
                    onUpdated={(status) =>
                      setIncidents((current) =>
                        current.map((item) =>
                          item.id === incident.id
                            ? { ...item, status }
                            : item
                        )
                      )
                    }
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
