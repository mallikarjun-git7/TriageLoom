"use client";

import { FormEvent, useEffect, useState } from "react";

type Organization = {
  id: string;
  name: string;
  role: "owner" | "admin" | "responder" | "viewer";
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  activeIncidents: number;
  status: "affected" | "no_active_incidents";
};

export function ServiceRegistry() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedOrganization = organizations.find(
    (org) => org.id === organizationId
  );

  const canCreate =
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

        if (!response.ok) {
          throw new Error("Unable to load organizations.");
        }

        const data = await response.json();
        const items: Organization[] = data.organizations ?? [];

        if (!controller.signal.aborted) {
          setOrganizations(items);
          setOrganizationId(items[0]?.id ?? "");
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load your organizations.");
          setLoading(false);
        }
      }
    }

    loadOrganizations();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setServices([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadServices() {
      setLoading(true);
      setError("");
      setServices([]);

      try {
        const response = await fetch(
          `/api/organizations/${organizationId}/services`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Unable to load services.");
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setServices(data.services ?? []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to retrieve services.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadServices();
    return () => controller.abort();
  }, [organizationId]);

  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId || !canCreate || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/services`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to create service.");
      }

      setServices((previous) =>
        [...previous, {
          ...data.service,
          activeIncidents: 0,
          status: "no_active_incidents" as const,
        }].sort((a, b) => a.name.localeCompare(b.name))
      );

      setName("");
      setDescription("");
      setSuccess("Service registered successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Service creation failed."
      );
    } finally {
      setSaving(false);
    }
  }

  const affected = services.filter(
    (service) => service.activeIncidents > 0
  ).length;

  return (
    <section className="mt-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-cyan-400">
            SERVICE OPERATIONS
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Service registry
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Track your services and their associated active incidents.
          </p>
        </div>

        <select
          aria-label="Service registry organization"
          value={organizationId}
          onChange={(event) => {
            setOrganizationId(event.target.value);
            setSuccess("");
          }}
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
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Registered services", value: services.length },
          { label: "Affected services", value: affected },
          {
            label: "Associated active incidents",
            value: services.reduce(
              (total, service) => total + service.activeIncidents,
              0
            ),
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-slate-800 bg-[#101a2d] p-5"
          >
            <p className="text-sm text-slate-400">{metric.label}</p>
            <p className="mt-3 text-3xl font-bold text-white">
              {loading ? "—" : metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-7">
          <h3 className="text-xl font-semibold text-white">
            Register a service
          </h3>

          {!canCreate ? (
            <p className="mt-4 text-sm text-slate-400">
              Organization owners and admins can register services.
            </p>
          ) : (
            <form onSubmit={createService} className="mt-6 space-y-5">
              <label className="block text-sm text-slate-300">
                Service name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="Payment API"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
              </label>

              <label className="block text-sm text-slate-300">
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="What does this service do?"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {saving ? "Registering..." : "Register service"}
              </button>
            </form>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-950 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="mt-4 rounded-xl bg-emerald-950 p-3 text-sm text-emerald-300">
              {success}
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-7">
          <h3 className="text-xl font-semibold text-white">
            Registered services
          </h3>

          <div className="mt-6 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-400">
                Loading services...
              </p>
            ) : services.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                No services registered yet.
              </p>
            ) : (
              services.map((service) => (
                <div
                  key={service.id}
                  className="rounded-xl border border-slate-700 bg-slate-900 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="font-semibold text-white">
                      {service.name}
                    </h4>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        service.activeIncidents > 0
                          ? "bg-orange-500/15 text-orange-300"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {service.activeIncidents > 0
                        ? "Affected"
                        : "No active incidents"}
                    </span>
                  </div>

                  {service.description && (
                    <p className="mt-3 text-sm text-slate-400">
                      {service.description}
                    </p>
                  )}

                  <p className="mt-4 text-xs text-slate-500">
                    {service.activeIncidents} associated active incidents
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
