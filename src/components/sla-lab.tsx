"use client";

import { useEffect, useState } from "react";

type Severity = "SEV1" | "SEV2" | "SEV3" | "SEV4";

type Policy = {
  severity: Severity;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
};

type Organization = {
  id: string;
  name: string;
  role: "owner" | "admin" | "responder" | "viewer";
};

const severities: Severity[] = ["SEV1", "SEV2", "SEV3", "SEV4"];

const defaults: Policy[] = [
  { severity: "SEV1", responseTargetMinutes: 15, resolutionTargetMinutes: 60 },
  { severity: "SEV2", responseTargetMinutes: 30, resolutionTargetMinutes: 240 },
  { severity: "SEV3", responseTargetMinutes: 60, resolutionTargetMinutes: 480 },
  { severity: "SEV4", responseTargetMinutes: 240, resolutionTargetMinutes: 1440 },
];

export function SlaLab() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Severity | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [testSeverity, setTestSeverity] = useState<Severity>("SEV1");
  const [responseMinutes, setResponseMinutes] = useState(10);
  const [resolutionMinutes, setResolutionMinutes] = useState(45);

  const selectedOrganization = organizations.find(
    (org) => org.id === organizationId
  );

  const canManage =
    selectedOrganization?.role === "owner" ||
    selectedOrganization?.role === "admin";

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
        if (controller.signal.aborted) return;

        const items: Organization[] = data.organizations ?? [];
        setOrganizations(items);
        setOrganizationId(items[0]?.id ?? "");
        if (!items.length) setLoading(false);
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load organizations.");
          setLoading(false);
        }
      }
    }

    loadOrganizations();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setPolicies([]);
    setMessage("");

    if (!organizationId) return;

    const controller = new AbortController();

    async function loadPolicies() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/organizations/${organizationId}/sla-policies`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load policies.");
        }

        if (!controller.signal.aborted) {
          setPolicies(data.policies ?? []);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Unable to load policies."
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadPolicies();
    return () => controller.abort();
  }, [organizationId]);

  function getPolicy(severity: Severity): Policy {
    return (
      policies.find((policy) => policy.severity === severity) ??
      defaults.find((policy) => policy.severity === severity)!
    );
  }

  function changeTarget(
    severity: Severity,
    field: "responseTargetMinutes" | "resolutionTargetMinutes",
    value: number
  ) {
    const current = getPolicy(severity);

    setPolicies((previous) => [
      ...previous.filter((item) => item.severity !== severity),
      { ...current, [field]: value },
    ]);

    setMessage("");
  }

  async function savePolicy(severity: Severity) {
    if (!organizationId || !canManage) return;

    setError("");
    setMessage("");
    setSaving(severity);

    try {
      const policy = getPolicy(severity);

      const response = await fetch(
        `/api/organizations/${organizationId}/sla-policies`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(policy),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save policy.");
      }

      setMessage(`${severity} policy saved to PostgreSQL.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Policy update failed."
      );
    } finally {
      setSaving(null);
    }
  }

  const selectedPolicy = getPolicy(testSeverity);
  const responsePass = responseMinutes <= selectedPolicy.responseTargetMinutes;
  const resolutionPass =
    resolutionMinutes <= selectedPolicy.resolutionTargetMinutes;

  return (
    <section className="mt-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-cyan-400">
            RELIABILITY ENGINEERING
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            SLA Lab
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Configure incident targets and simulate response performance.
          </p>
        </div>

        <select
          aria-label="SLA organization"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
        >
          {!organizationId && <option value="">Select workspace</option>}
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-950 p-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-xl bg-emerald-950 p-4 text-sm text-emerald-300">
          {message}
        </p>
      )}

      <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-7">
        <h3 className="text-xl font-semibold text-white">SLA policies</h3>
        <p className="mt-2 text-sm text-slate-400">
          Targets are expressed in minutes from incident creation.
          Initial values are examples until individually saved.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {severities.map((severity) => {
            const policy = getPolicy(severity);
            const isSaved = policies.some(
              (item) => item.severity === severity
            );

            return (
              <div
                key={severity}
                className="rounded-2xl border border-slate-700 bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white">{severity}</h4>
                  <span className="text-xs text-slate-400">
                    {isSaved ? "Loaded or edited" : "Example targets"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-300">
                    Response minutes
                    <input
                      type="number"
                      min={1}
                      max={43200}
                      disabled={!canManage || loading}
                      value={policy.responseTargetMinutes}
                      onChange={(event) =>
                        changeTarget(
                          severity,
                          "responseTargetMinutes",
                          Number(event.target.value)
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-white"
                    />
                  </label>

                  <label className="text-xs text-slate-300">
                    Resolution minutes
                    <input
                      type="number"
                      min={1}
                      max={43200}
                      disabled={!canManage || loading}
                      value={policy.resolutionTargetMinutes}
                      onChange={(event) =>
                        changeTarget(
                          severity,
                          "resolutionTargetMinutes",
                          Number(event.target.value)
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-[#101a2d] px-3 py-2 text-white"
                    />
                  </label>
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => savePolicy(severity)}
                    disabled={loading || saving !== null}
                    className="mt-5 w-full rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
                  >
                    {saving === severity ? "Saving..." : `Save ${severity} policy`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-7">
        <h3 className="text-xl font-semibold text-white">SLA simulator</h3>
        <p className="mt-2 text-sm text-slate-400">
          Evaluate a hypothetical incident without changing real incident records.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="text-sm text-slate-300">
            Severity
            <select
              value={testSeverity}
              onChange={(event) =>
                setTestSeverity(event.target.value as Severity)
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            >
              {severities.map((severity) => (
                <option key={severity} value={severity}>{severity}</option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-300">
            Response time (minutes)
            <input
              type="number"
              min={0}
              value={responseMinutes}
              onChange={(event) =>
                setResponseMinutes(Math.max(0, Number(event.target.value)))
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            />
          </label>

          <label className="text-sm text-slate-300">
            Resolution time (minutes)
            <input
              type="number"
              min={0}
              value={resolutionMinutes}
              onChange={(event) =>
                setResolutionMinutes(Math.max(0, Number(event.target.value)))
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Response target: {selectedPolicy.responseTargetMinutes} min
            </p>
            <p className={`mt-3 text-xl font-semibold ${
              responsePass ? "text-emerald-300" : "text-red-300"
            }`}>
              {responsePass ? "Within target" : "Response SLA breached"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Resolution target: {selectedPolicy.resolutionTargetMinutes} min
            </p>
            <p className={`mt-3 text-xl font-semibold ${
              resolutionPass ? "text-emerald-300" : "text-red-300"
            }`}>
              {resolutionPass ? "Within target" : "Resolution SLA breached"}
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          This is a target-comparison simulator, not a live SLA monitor.
        </p>
      </div>
    </section>
  );
}
