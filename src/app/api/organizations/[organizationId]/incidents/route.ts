import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  incidents,
  incidentEvents,
  services,
} from "@/db/schema";
import { requireOrganizationAccess } from "@/lib/organization-access";

type Context = {
  params: Promise<{ organizationId: string }>;
};

const createIncidentSchema = z.object({
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().max(5000).optional(),
  severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]),
  serviceId: z.string().uuid().optional(),
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
    "incident:read"
  );

  if (!access.ok) return access.response;

  try {
    const records = await db
      .select({
        id: incidents.id,
        title: incidents.title,
        description: incidents.description,
        severity: incidents.severity,
        status: incidents.status,
        serviceId: incidents.serviceId,
        createdById: incidents.createdById,
        assignedToId: incidents.assignedToId,
        createdAt: incidents.createdAt,
        updatedAt: incidents.updatedAt,
      })
      .from(incidents)
      .where(eq(incidents.organizationId, organizationId))
      .orderBy(desc(incidents.createdAt))
      .limit(50);

    return NextResponse.json({ incidents: records });
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve incidents" },
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

  const origin = request.headers.get("origin");

  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  const access = await requireOrganizationAccess(
    organizationId,
    "incident:create"
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

  const parsed = createIncidentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid incident information" },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.serviceId) {
      const [service] = await db
        .select({ id: services.id })
        .from(services)
        .where(
          and(
            eq(services.id, parsed.data.serviceId),
            eq(services.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!service) {
        return NextResponse.json(
          { error: "Service not found in this organization" },
          { status: 404 }
        );
      }
    }

    const incident = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(incidents)
        .values({
          organizationId,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          severity: parsed.data.severity,
          serviceId: parsed.data.serviceId ?? null,
          createdById: access.userId,
          status: "open",
        })
        .returning();

      await tx.insert(incidentEvents).values({
        organizationId,
        incidentId: created.id,
        actorId: access.userId,
        eventType: "incident.created",
        details: JSON.stringify({
          severity: created.severity,
          status: created.status,
          title: created.title,
        }),
      });

      return created;
    });

    return NextResponse.json(
      { incident },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to create incident" },
      { status: 500 }
    );
  }
}
