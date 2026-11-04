"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Organization = {
  id: string;
  name: string;
  role: "owner" | "admin" | "responder" | "viewer";
};

type Node = {
  id: string;
  name: string;
  activeIncidents: number;
  impact: "direct" | "potential" | "none";
};

type Edge = {
  id: string;
  dependentServiceId: string;
  dependencyServiceId: string;
};

type GraphData = {
  nodes: Node[];
  edges: Edge[];
};

const colors = {
  direct: {
    fill: "#451a25",
    stroke: "#fb7185",
    text: "#fecdd3",
  },
  potential: {
    fill: "#453014",
    stroke: "#fbbf24",
    text: "#fde68a",
  },
  none: {
    fill: "#172439",
    stroke: "#64748b",
    text: "#e2e8f0",
  },
};

export function ImpactGraph() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [dependent, setDependent] = useState("");
  const [dependency, setDependency] = useState("");
  const [revision, setRevision] = useState(0);
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

        if (!response.ok) throw new Error("Unable to load workspaces.");

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
    setGraph({ nodes: [], edges: [] });
    setDependent("");
    setDependency("");

    if (!organizationId) return;

    const controller = new AbortController();

    async function loadGraph() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/organizations/${organizationId}/dependencies`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load dependency graph.");
        }

        if (!controller.signal.aborted) {
          setGraph(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Unable to load graph."
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadGraph();
    return () => controller.abort();
  }, [organizationId, revision]);

  const selectedOrganization = organizations.find(
    (item) => item.id === organizationId
  );

  const canEdit =
    selectedOrganization?.role === "owner" ||
    selectedOrganization?.role === "admin";

  const positions = useMemo(() => {
    const result = new Map<string, { x: number; y: number }>();

    graph.nodes.forEach((node, index) => {
      result.set(node.id, {
        x: 110 + (index % 3) * 225,
        y: 60 + Math.floor(index / 3) * 145,
      });
    });

    return result;
  }, [graph.nodes]);

  const graphHeight = Math.max(
    180,
    Math.ceil(graph.nodes.length / 3) * 145 + 40
  );

  const directCount = graph.nodes.filter(
    (node) => node.impact === "direct"
  ).length;

  const potentialCount = graph.nodes.filter(
    (node) => node.impact === "potential"
  ).length;

  async function addDependency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId || !dependent || !dependency || saving) return;

    if (dependent === dependency) {
      setError("Choose two different services.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/dependencies`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dependentServiceId: dependent,
            dependencyServiceId: dependency,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to create dependency.");
      }

      setSuccess("Service dependency created successfully.");
      setDependent("");
      setDependency("");
      setRevision((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Dependency creation failed."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white";

  return (
    <section className="mt-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-cyan-400">
            DEPENDENCY INTELLIGENCE
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            ImpactGraph
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Discover service relationships and potential downstream impact.
          </p>
        </div>

        <select
          aria-label="ImpactGraph organization"
          value={organizationId}
          onChange={(event) => {
            setOrganizationId(event.target.value);
            setSuccess("");
          }}
          className={inputClass}
        >
          {!organizationId && <option value="">Select workspace</option>}
          {organizations.map((org) => (
            <option value={org.id} key={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Service dependencies", graph.edges.length],
          ["Directly affected", directCount],
          ["Potentially affected", potentialCount],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-800 bg-[#101a2d] p-5"
          >
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-bold text-white">
              {loading ? "—" : value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-7">
          <h3 className="text-xl font-semibold text-white">
            Connect services
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            Specify which service depends on another service.
          </p>

          {!canEdit ? (
            <p className="mt-6 text-sm text-slate-400">
              Only organization owners and admins can manage dependencies.
            </p>
          ) : (
            <form onSubmit={addDependency} className="mt-6 space-y-5">
              <label className="block text-sm text-slate-300">
                Service
                <select
                  required
                  value={dependent}
                  onChange={(event) => setDependent(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose service</option>
                  {graph.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                Depends on
                <select
                  required
                  value={dependency}
                  onChange={(event) => setDependency(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose dependency</option>
                  {graph.nodes
                    .filter((node) => node.id !== dependent)
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={saving || loading || graph.nodes.length < 2}
                className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {saving ? "Saving dependency..." : "Add dependency"}
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

          <p className="mt-6 text-xs text-slate-500">
            Arrows point from the dependent service toward the service
            it relies on.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-white">
              Service dependency map
            </h3>

            <button
              type="button"
              onClick={() => setRevision((value) => value + 1)}
              disabled={loading || !organizationId}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-cyan-400 disabled:opacity-50"
            >
              Refresh graph
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-300">
            <span>🔴 Direct impact</span>
            <span>🟡 Potential downstream impact</span>
            <span>⚪ No known incident impact</span>
          </div>

          {loading ? (
            <p className="mt-10 text-sm text-slate-400">
              Loading dependency graph...
            </p>
          ) : graph.nodes.length === 0 ? (
            <p className="mt-10 text-sm text-slate-400">
              Register services first to build your graph.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-xl bg-[#0b1426]">
              <svg
                viewBox={`0 0 680 ${graphHeight}`}
                className="min-w-[480px] w-full"
                role="img"
                aria-label="Service dependency graph"
              >
                <defs>
                  <marker
                    id="impactgraph-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
                  </marker>
                </defs>

                {graph.edges.map((edge) => {
                  const from = positions.get(edge.dependentServiceId);
                  const to = positions.get(edge.dependencyServiceId);

                  if (!from || !to) return null;

                  return (
                    <line
                      key={edge.id}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeOpacity="0.8"
                      markerEnd="url(#impactgraph-arrow)"
                    />
                  );
                })}

                {graph.nodes.map((node) => {
                  const position = positions.get(node.id)!;
                  const style = colors[node.impact];

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${position.x - 85}, ${position.y - 29})`}
                    >
                      <rect
                        width="170"
                        height="58"
                        rx="12"
                        fill={style.fill}
                        stroke={style.stroke}
                        strokeWidth="2"
                      />
                      <text
                        x="85"
                        y="24"
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="600"
                        fill={style.text}
                      >
                        {node.name.length > 22
                          ? node.name.slice(0, 21) + "…"
                          : node.name}
                      </text>
                      <text
                        x="85"
                        y="44"
                        textAnchor="middle"
                        fontSize="10"
                        fill={style.text}
                      >
                        {node.activeIncidents} linked active incidents
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
