import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { canTransition } from "@/lib/incident-lifecycle";
import { incidents, incidentEvents } from "@/db/schema";
import { requireOrganizationAccess } from "@/lib/organization-access";

type Context = {
  params: Promise<{
    organizationId: string;
    incidentId: string;
  }>;
};

const statusSchema = z.object({
  status: z.enum([
    "open",
    "investigating",
    "mitigating",
    "resolved",
  ]),
}).strict();




export async function GET(
  _request: NextRequest,
  context: Context
) {
  const { organizationId, incidentId } = await context.params;

  if (
    !z.string().uuid().safeParse(organizationId).success ||
    !z.string().uuid().safeParse(incidentId).success
  ) {
    return NextResponse.json(
      { error: "Invalid ID" },
      { status: 400 }
    );
  }

  const access = await requireOrganizationAccess(
    organizationId,
    "incident:read"
  );

  if (!access.ok) return access.response;

  const [incident] = await db
    .select()
    .from(incidents)
    .where(
      and(
        eq(incidents.id, incidentId),
        eq(incidents.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!incident) {
    return NextResponse.json(
      { error: "Incident not found" },
      { status: 404 }
    );
  }

  const events = await db
    .select({
      id: incidentEvents.id,
      eventType: incidentEvents.eventType,
      details: incidentEvents.details,
      actorId: incidentEvents.actorId,
      createdAt: incidentEvents.createdAt,
    })
    .from(incidentEvents)
    .where(
      and(
        eq(incidentEvents.organizationId, organizationId),
        eq(incidentEvents.incidentId, incidentId)
      )
    )
    .orderBy(
      asc(incidentEvents.createdAt),
      asc(incidentEvents.id)
    );

  return NextResponse.json({ incident, events });
}

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  const { organizationId, incidentId } = await context.params;

  if (
    !z.string().uuid().safeParse(organizationId).success ||
    !z.string().uuid().safeParse(incidentId).success
  ) {
    return NextResponse.json(
      { error: "Invalid ID" },
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
    "incident:update"
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

  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid status" },
      { status: 400 }
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ status: incidents.status })
        .from(incidents)
        .where(
          and(
            eq(incidents.id, incidentId),
            eq(incidents.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!current) return { type: "missing" as const };

      const nextStatus = parsed.data.status;

      if (!canTransition(current.status, nextStatus)) {
        return { type: "invalid" as const };
      }

      const [updated] = await tx
        .update(incidents)
        .set({
          status: nextStatus,
          updatedAt: new Date(),
          resolvedAt:
            nextStatus === "resolved" ? new Date() : null,
        })
        .where(
          and(
            eq(incidents.id, incidentId),
            eq(incidents.organizationId, organizationId),
            eq(incidents.status, current.status)
          )
        )
        .returning();

      if (!updated) {
        return { type: "conflict" as const };
      }

      await tx.insert(incidentEvents).values({
        organizationId,
        incidentId,
        actorId: access.userId,
        eventType: "incident.status_changed",
        details: JSON.stringify({
          from: current.status,
          to: updated.status,
        }),
      });

      return { type: "success" as const, incident: updated };
    });

    if (result.type === "missing") {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }

    if (result.type === "invalid") {
      return NextResponse.json(
        { error: "Invalid status transition" },
        { status: 409 }
      );
    }

    if (result.type === "conflict") {
      return NextResponse.json(
        { error: "Incident changed; refresh and try again" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      incident: result.incident,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to update incident" },
      { status: 500 }
    );
  }
}
