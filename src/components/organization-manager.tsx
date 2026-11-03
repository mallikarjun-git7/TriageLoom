"use client";

import { FormEvent, useEffect, useState } from "react";

type Organization = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "responder" | "viewer";
};

export function OrganizationManager() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrganizations() {
      try {
        const response = await fetch("/api/organizations", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load organizations.");
        }

        const data = await response.json();
        setOrganizations(data.organizations);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Something went wrong."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadOrganizations();

    return () => controller.abort();
  }, []);

  function updateName(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    );
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to create organization.");
      }

      setOrganizations((previous) => [...previous, data.organization]);
      setSuccess("Organization created successfully.");
      setName("");
      setSlug("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-7">
        <p className="text-xs font-semibold tracking-[0.2em] text-cyan-400">
          WORKSPACE SETUP
        </p>

        <h2 className="mt-3 text-2xl font-semibold">
          Create organization
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          Set up a workspace for your incident operations.
          You will become its owner automatically.
        </p>

        <form onSubmit={createOrganization} className="mt-7 space-y-5">
          <label className="block text-sm text-slate-300">
            Organization name
            <input
              value={name}
              onChange={(event) => updateName(event.target.value)}
              required
              minLength={2}
              maxLength={160}
              placeholder="Example: Acme Engineering"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="block text-sm text-slate-300">
            Organization slug
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              required
              maxLength={100}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="acme-engineering"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-300">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create organization"}
          </button>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-[#101a2d] p-7">
        <p className="text-xs font-semibold tracking-[0.2em] text-cyan-400">
          YOUR WORKSPACES
        </p>

        <h2 className="mt-3 text-2xl font-semibold">
          Organizations
        </h2>

        <div className="mt-7 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-400">
              Loading organizations...
            </p>
          ) : organizations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
              No organizations yet. Create your first workspace.
            </p>
          ) : (
            organizations.map((organization) => (
              <div
                key={organization.id}
                className="rounded-xl border border-slate-700 bg-slate-900 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">
                    {organization.name}
                  </h3>
                  <span className="rounded-full bg-cyan-950 px-3 py-1 text-xs font-medium text-cyan-300">
                    {organization.role}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  /{organization.slug}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
