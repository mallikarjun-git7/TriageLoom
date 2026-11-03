import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { incidents, services } from "@/db/schema";
import { requireOrganizationAccess } from "@/lib/organization-access";

type Context = {
  params: Promise<{ organizationId: string }>;
};

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
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
    const records = await db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        createdAt: services.createdAt,
      })
      .from(services)
      .where(eq(services.organizationId, organizationId))
      .orderBy(asc(services.name));

    const impactCounts = await db
      .select({
        serviceId: incidents.serviceId,
        activeIncidents: sql<number>`count(*)::int`,
      })
      .from(incidents)
      .where(
        and(
          eq(incidents.organizationId, organizationId),
          ne(incidents.status, "resolved")
        )
      )
      .groupBy(incidents.serviceId);

    const counts = new Map(
      impactCounts.map((item) => [
        item.serviceId,
        item.activeIncidents,
      ])
    );

    return NextResponse.json({
      services: records.map((service) => {
        const activeIncidents = counts.get(service.id) ?? 0;

        return {
          ...service,
          activeIncidents,
          status: activeIncidents > 0
            ? "affected"
            : "no_active_incidents",
        };
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve services" },
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

  const parsed = serviceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid service information" },
      { status: 400 }
    );
  }

  try {
    const [service] = await db
      .insert(services)
      .values({
        organizationId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      })
      .returning();

    return NextResponse.json(
      { service },
      { status: 201 }
    );
  } catch (error) {
    const dbError = error as {
      code?: string;
      cause?: { code?: string };
    };

    if (
      dbError.code === "23505" ||
      dbError.cause?.code === "23505"
    ) {
      return NextResponse.json(
        { error: "Service name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Unable to create service" },
      { status: 500 }
    );
  }
}
