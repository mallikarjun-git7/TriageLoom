"use client";

import { useCallback, useEffect, useState } from "react";

type Organization = {
  id: string;
  name: string;
};

type Analytics = {
  summary: {
    total: number;
    active: number;
    resolved: number;
    averageResolutionMinutes: number | null;
    registeredServices: number;
  };
  bySeverity: {
    severity: string;
    count: number;
  }[];
  byStatus: {
    status: string;
    count: number;
  }[];
};

const severityOrder = ["SEV1", "SEV2", "SEV3", "SEV4"];
const statusOrder = [
  "open",
  "investigating",
  "mitigating",
  "resolved",
];

export function OperationsAnalytics() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/organizations", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load workspaces.");
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const items: Organization[] = data.organizations ?? [];
        setOrganizations(items);
        setOrganizationId(items[0]?.id ?? "");
        if (!items.length) setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Unable to load workspaces.");
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setAnalytics(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    setAnalytics(null);

    fetch(`/api/organizations/${organizationId}/analytics`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load analytics.");
        }
        return data as Analytics;
      })
      .then((data) => {
        if (!controller.signal.aborted) setAnalytics(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Analytics unavailable."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [organizationId, revision]);

  function breakdown(
    heading: string,
    values: string[],
    rows: { count: number; [key: string]: string | number }[],
    key: "severity" | "status"
  ) {
    const total = analytics?.summary.total ?? 0;

    return (
      <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-7">
        <h3 className="text-xl font-semibold text-white">{heading}</h3>
        <div className="mt-7 space-y-5">
          {values.map((label) => {
            const count = rows.find((row) => row[key] === label)?.count ?? 0;
            const percentage = total ? (count / total) * 100 : 0;

            return (
              <div key={label}>
                <div className="mb-2 flex justify-between gap-3 text-sm">
                  <span className="capitalize text-slate-300">{label}</span>
                  <span className="font-semibold text-white">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const summary = analytics?.summary;
  const average = summary?.averageResolutionMinutes;

  return (
    <section className="mt-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-cyan-400">
            OPERATIONAL INTELLIGENCE
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Incident analytics
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Live database-derived incident and resolution statistics.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Analytics organization"
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
          <button
            type="button"
            onClick={refresh}
            disabled={!organizationId || loading}
            className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-white hover:border-cyan-400 disabled:opacity-50"
          >
            Refresh metrics
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-950 p-4 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total incidents", value: summary?.total },
          { label: "Active incidents", value: summary?.active },
          { label: "Resolved incidents", value: summary?.resolved },
          {
            label: "Avg. resolution time",
            value:
              average == null
                ? "N/A"
                : `${average.toFixed(1)} min`,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-slate-800 bg-[#101a2d] p-5"
          >
            <p className="text-sm text-slate-400">{metric.label}</p>
            <p className="mt-3 text-2xl font-bold text-white">
              {loading ? "—" : metric.value ?? "—"}
            </p>
          </div>
        ))}
      </div>

      {analytics && (
        <div className="grid gap-6 lg:grid-cols-2">
          {breakdown(
            "Incidents by severity",
            severityOrder,
            analytics.bySeverity,
            "severity"
          )}
          {breakdown(
            "Incidents by status",
            statusOrder,
            analytics.byStatus,
            "status"
          )}
        </div>
      )}
    </section>
  );
}
