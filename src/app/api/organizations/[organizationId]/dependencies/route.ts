import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  incidents,
  services,
  serviceDependencies,
} from "@/db/schema";
import { requireOrganizationAccess } from "@/lib/organization-access";

type Context = {
  params: Promise<{ organizationId: string }>;
};

const dependencySchema = z.object({
  dependentServiceId: z.string().uuid(),
  dependencyServiceId: z.string().uuid(),
}).strict();

export async function GET(
  _request: NextRequest,
  context: Context
) {
  const { organizationId } = await context.params;

  if (!z.string().uuid().safeParse(organizationId).success) {
    return NextResponse.json(
      { error: "Invalid organization ID" },
      { status: 400 }
    );
  }

  const access = await requireOrganizationAccess(
    organizationId,
    "organization:read"
  );

  if (!access.ok) return access.response;

  try {
    const [nodes, edges, impacts] = await Promise.all([
      db.select({
        id: services.id,
        name: services.name,
      })
        .from(services)
        .where(eq(services.organizationId, organizationId)),

      db.select({
        id: serviceDependencies.id,
        dependentServiceId: serviceDependencies.dependentServiceId,
        dependencyServiceId: serviceDependencies.dependencyServiceId,
      })
        .from(serviceDependencies)
        .where(eq(serviceDependencies.organizationId, organizationId)),

      db.select({
        serviceId: incidents.serviceId,
        count: sql<number>`count(*)::int`,
      })
        .from(incidents)
        .where(
          and(
            eq(incidents.organizationId, organizationId),
            ne(incidents.status, "resolved")
          )
        )
        .groupBy(incidents.serviceId),
    ]);

    const activeCounts = new Map(
      impacts.map((item) => [item.serviceId, item.count])
    );

    // Traverse reverse dependencies to identify downstream impact.
    const downstream = new Map<string, string[]>();

    for (const edge of edges) {
      const list = downstream.get(edge.dependencyServiceId) ?? [];
      list.push(edge.dependentServiceId);
      downstream.set(edge.dependencyServiceId, list);
    }

    const direct = new Set(
      impacts
        .filter((item) => item.serviceId && item.count > 0)
        .map((item) => item.serviceId as string)
    );

    const potentiallyAffected = new Set<string>();
    const queue = [...direct];
    const visited = new Set(queue);

    while (queue.length) {
      const current = queue.shift()!;

      for (const dependent of downstream.get(current) ?? []) {
        if (!visited.has(dependent)) {
          visited.add(dependent);
          queue.push(dependent);
        }

        if (!direct.has(dependent)) {
          potentiallyAffected.add(dependent);
        }
      }
    }

    return NextResponse.json({
      nodes: nodes.map((node) => ({
        ...node,
        activeIncidents: activeCounts.get(node.id) ?? 0,
        impact: direct.has(node.id)
          ? "direct"
          : potentiallyAffected.has(node.id)
            ? "potential"
            : "none",
      })),
      edges,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load dependency graph" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: Context
) {
  const { organizationId } = await context.params;

  if (!z.string().uuid().safeParse(organizationId).success) {
    return NextResponse.json(
      { error: "Invalid organization ID" },
      { status: 400 }
    );
  }

  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  const access = await requireOrganizationAccess(
    organizationId,
    "service:create"
  );

  if (!access.ok) return access.response;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = dependencySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid dependency" },
      { status: 400 }
    );
  }

  const { dependentServiceId, dependencyServiceId } = parsed.data;

  if (dependentServiceId === dependencyServiceId) {
    return NextResponse.json(
      { error: "A service cannot depend on itself" },
      { status: 400 }
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Serialize dependency creation within this organization.
      // This prevents concurrent requests from introducing cycles.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`
      );

      const records = await tx
        .select({ id: services.id })
        .from(services)
        .where(eq(services.organizationId, organizationId));

      const validIds = new Set(records.map((item) => item.id));

      if (
        !validIds.has(dependentServiceId) ||
        !validIds.has(dependencyServiceId)
      ) {
        return { type: "missing" as const };
      }

      const edges = await tx
        .select({
          dependentServiceId: serviceDependencies.dependentServiceId,
          dependencyServiceId: serviceDependencies.dependencyServiceId,
        })
        .from(serviceDependencies)
        .where(eq(serviceDependencies.organizationId, organizationId));

      if (edges.some((edge) =>
        edge.dependentServiceId === dependentServiceId &&
        edge.dependencyServiceId === dependencyServiceId
      )) {
        return { type: "duplicate" as const };
      }

      // An edge A -> B creates a cycle if B already reaches A.
      const adjacency = new Map<string, string[]>();

      for (const edge of edges) {
        const list = adjacency.get(edge.dependentServiceId) ?? [];
        list.push(edge.dependencyServiceId);
        adjacency.set(edge.dependentServiceId, list);
      }

      const stack = [dependencyServiceId];
      const visited = new Set<string>();

      while (stack.length) {
        const current = stack.pop()!;

        if (current === dependentServiceId) {
          return { type: "cycle" as const };
        }

        if (visited.has(current)) continue;
        visited.add(current);

        stack.push(...(adjacency.get(current) ?? []));
      }

      const [created] = await tx
        .insert(serviceDependencies)
        .values({
          organizationId,
          dependentServiceId,
          dependencyServiceId,
        })
        .returning();

      return { type: "success" as const, dependency: created };
    });

    if (result.type === "missing") {
      return NextResponse.json(
        { error: "Both services must belong to your organization" },
        { status: 404 }
      );
    }

    if (result.type === "duplicate") {
      return NextResponse.json(
        { error: "Dependency already exists" },
        { status: 409 }
      );
    }

    if (result.type === "cycle") {
      return NextResponse.json(
        { error: "Dependency would create a circular relationship" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { dependency: result.dependency },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to create dependency" },
      { status: 500 }
    );
  }
}
