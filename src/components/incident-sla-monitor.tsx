"use client";

import { useEffect, useState } from "react";

type Organization = {
  id: string;
  name: string;
};

type Result = "met" | "breached" | "pending" | "not_configured";

type Measurement = {
  result: Result;
  elapsedMinutes: number;
  targetMinutes: number | null;
};

type Evaluation = {
  incidentId: string;
  title: string;
  severity: string;
  status: string;
  response: Measurement;
  resolution: Measurement;
};

type EvaluationData = {
  evaluatedAt: string;
  evaluatedCount: number;
  limit: number;
  evaluations: Evaluation[];
};

const resultLabels: Record<Result, string> = {
  met: "Met",
  breached: "Breached",
  pending: "Pending",
  not_configured: "Not configured",
};

const resultStyles: Record<Result, string> = {
  met: "bg-emerald-500/15 text-emerald-300",
  breached: "bg-red-500/15 text-red-300",
  pending: "bg-amber-500/15 text-amber-300",
  not_configured: "bg-slate-700 text-slate-300",
};

function MeasurementCard({
  label,
  measurement,
}: {
  label: string;
  measurement: Measurement;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-[#0b1426] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-slate-300">{label}</span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            resultStyles[measurement.result]
          }`}
        >
          {resultLabels[measurement.result]}
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-400">
        Elapsed: {measurement.elapsedMinutes.toFixed(1)} min
      </p>
      <p className="mt-1 text-sm text-slate-400">
        Target: {measurement.targetMinutes ?? "Not configured"} min
      </p>
    </div>
  );
}

export function IncidentSlaMonitor() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [data, setData] = useState<EvaluationData | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrganizations() {
      try {
        const response = await fetch("/api/organizations", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Unable to load workspaces.");

        const result = await response.json();

        if (!controller.signal.aborted) {
          const items: Organization[] = result.organizations ?? [];
          setOrganizations(items);
          setOrganizationId(items[0]?.id ?? "");
          if (!items.length) setLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load workspaces.");
          setLoading(false);
        }
      }
    }

    loadOrganizations();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setData(null);

    if (!organizationId) return;

    const controller = new AbortController();

    async function loadEvaluations() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/organizations/${organizationId}/sla-evaluation`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to evaluate SLAs.");
        }

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "SLA evaluation failed."
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadEvaluations();
    return () => controller.abort();
  }, [organizationId, revision]);

  const evaluations = data?.evaluations ?? [];

  const responseBreaches = evaluations.filter(
    (item) => item.response.result === "breached"
  ).length;

  const resolutionBreaches = evaluations.filter(
    (item) => item.resolution.result === "breached"
  ).length;

  return (
    <section className="mt-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-cyan-400">
            INCIDENT RELIABILITY
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Real Incident SLA Monitoring
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Compare actual incident history against current SLA policies.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            aria-label="SLA monitoring organization"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white"
          >
            {!organizationId && (
              <option value="">Select workspace</option>
            )}
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
            disabled={!organizationId || loading}
            className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-white hover:border-cyan-400 disabled:opacity-50"
          >
            Refresh evaluations
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-950 p-4 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Incidents evaluated", value: data?.evaluatedCount },
          { label: "Response breaches", value: responseBreaches },
          { label: "Resolution breaches", value: resolutionBreaches },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-slate-800 bg-[#101a2d] p-5"
          >
            <p className="text-sm text-slate-400">{metric.label}</p>
            <p className="mt-3 text-3xl font-bold text-white">
              {loading ? "—" : metric.value ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-7">
        <h3 className="text-xl font-semibold text-white">
          Incident SLA results
        </h3>

        {data && (
          <p className="mt-2 text-xs text-slate-500">
            Evaluated at {new Date(data.evaluatedAt).toLocaleString()}.
            Results are limited to the first {data.limit} incidents.
          </p>
        )}

        <div className="mt-6 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-400">
              Evaluating incident history...
            </p>
          ) : evaluations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
              No incidents available for SLA evaluation.
            </p>
          ) : (
            evaluations.map((incident) => (
              <article
                key={incident.incidentId}
                className="rounded-2xl border border-slate-700 bg-slate-900 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-semibold text-white">
                    {incident.title}
                  </h4>

                  <div className="flex gap-2 text-xs">
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
                      {incident.severity}
                    </span>
                    <span className="rounded-full bg-slate-800 px-3 py-1 capitalize text-slate-200">
                      {incident.status}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <MeasurementCard
                    label="Response SLA"
                    measurement={incident.response}
                  />
                  <MeasurementCard
                    label="Resolution SLA"
                    measurement={incident.resolution}
                  />
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Response is measured from creation to the first investigating
        transition. Resolution is measured using the current resolved
        state and its timestamp. Historical incidents are evaluated
        against current policy settings.
      </p>
    </section>
  );
}
