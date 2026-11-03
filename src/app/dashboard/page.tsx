import { ServiceRegistry } from "@/components/service-registry";
import { IncidentManager } from "@/components/incident-manager";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { OrganizationManager } from "@/components/organization-manager";

async function AuthenticatedDashboard() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#080e1c] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-7">
          <div>
            <p className="text-sm font-semibold tracking-[0.25em] text-cyan-400">
              TRIAGELOOM
            </p>
            <h1 className="mt-3 text-3xl font-bold">
              Operations dashboard
            </h1>
          </div>
          <LogoutButton />
        </header>

        <section className="mt-10 rounded-3xl border border-slate-800 bg-[#101a2d] p-8">
          <p className="text-sm text-cyan-400">AUTHENTICATED SESSION</p>
          <h2 className="mt-3 text-2xl font-semibold">
            Welcome, {session.user.name}
          </h2>
          <p className="mt-2 text-slate-400">
            {session.user.email}
          </p>
          <p className="mt-8 text-sm text-slate-400">
            Your secure dashboard is active. Incident management,
            organization access and operational analytics will appear
            here as we implement them.
          </p>
        </section>

        <OrganizationManager />
        <IncidentManager />
        <ServiceRegistry />
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#080e1c] p-10 text-slate-300">
        Loading dashboard...
      </main>
    }>
      <AuthenticatedDashboard />
    </Suspense>
  );
}
