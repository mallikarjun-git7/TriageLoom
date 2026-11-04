import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { incidents, services } from "@/db/schema";
import { requireOrganizationAccess } from "@/lib/organization-access";

type Context = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(_request: Request, context: Context) {
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
    const [summaryRows, severityRows, statusRows, serviceRows] =
      await Promise.all([
        db.select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`
            count(*) filter (
              where ${incidents.status} <> 'resolved'
            )::int
          `,
          resolved: sql<number>`
            count(*) filter (
              where ${incidents.status} = 'resolved'
            )::int
          `,
          averageResolutionMinutes: sql<number | null>`
            round(
              avg(
                extract(epoch from (
                  ${incidents.resolvedAt} - ${incidents.createdAt}
                )) / 60
              )::numeric,
              1
            )::float8
          `,
        })
          .from(incidents)
          .where(eq(incidents.organizationId, organizationId)),

        db.select({
          severity: incidents.severity,
          count: sql<number>`count(*)::int`,
        })
          .from(incidents)
          .where(eq(incidents.organizationId, organizationId))
          .groupBy(incidents.severity),

        db.select({
          status: incidents.status,
          count: sql<number>`count(*)::int`,
        })
          .from(incidents)
          .where(eq(incidents.organizationId, organizationId))
          .groupBy(incidents.status),

        db.select({
          id: services.id,
          name: services.name,
        })
          .from(services)
          .where(eq(services.organizationId, organizationId)),
      ]);

    const summary = summaryRows[0];

    return NextResponse.json({
      summary: {
        total: summary.total,
        active: summary.active,
        resolved: summary.resolved,
        averageResolutionMinutes: summary.averageResolutionMinutes,
        registeredServices: serviceRows.length,
      },
      bySeverity: severityRows,
      byStatus: statusRows,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve analytics" },
      { status: 500 }
    );
  }
}
