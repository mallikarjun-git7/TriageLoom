import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  incidents,
  incidentEvents,
  slaPolicies,
} from "@/db/schema";
import { requireOrganizationAccess } from "@/lib/organization-access";

type Context = {
  params: Promise<{ organizationId: string }>;
};

type SlaResult = "met" | "breached" | "pending" | "not_configured";

function evaluate(
  elapsedMinutes: number,
  targetMinutes: number | undefined,
  completed: boolean
): SlaResult {
  if (targetMinutes === undefined) return "not_configured";
  if (elapsedMinutes > targetMinutes) return "breached";
  return completed ? "met" : "pending";
}

export async function GET(
  _request: Request,
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
    const [records, policies] = await Promise.all([
      db.select()
        .from(incidents)
        .where(eq(incidents.organizationId, organizationId))
        .orderBy(asc(incidents.createdAt))
        .limit(200),

      db.select()
        .from(slaPolicies)
        .where(eq(slaPolicies.organizationId, organizationId)),
    ]);

    const ids = records.map((incident) => incident.id);

    const events = ids.length
      ? await db.select()
          .from(incidentEvents)
          .where(
            and(
              eq(incidentEvents.organizationId, organizationId),
              inArray(incidentEvents.incidentId, ids)
            )
          )
          .orderBy(asc(incidentEvents.createdAt))
      : [];

    const policyMap = new Map(
      policies.map((policy) => [policy.severity, policy])
    );

    const now = Date.now();

    const evaluations = records.map((incident) => {
      const policy = policyMap.get(incident.severity);

      const incidentHistory = events.filter(
        (event) => event.incidentId === incident.id
      );

      const firstInvestigation = incidentHistory.find((event) => {
        if (event.eventType !== "incident.status_changed") {
          return false;
        }

        try {
          const details = JSON.parse(event.details ?? "{}");
          return details.to === "investigating";
        } catch {
          return false;
        }
      });

      const startTime = incident.createdAt.getTime();

      const responseEnd =
        firstInvestigation?.createdAt.getTime() ?? now;

      const isResolved =
        incident.status === "resolved" &&
        incident.resolvedAt !== null;

      const resolutionEnd = isResolved
        ? incident.resolvedAt!.getTime()
        : now;

      const responseMinutes = Math.max(
        0,
        (responseEnd - startTime) / 60000
      );

      const resolutionMinutes = Math.max(
        0,
        (resolutionEnd - startTime) / 60000
      );

      return {
        incidentId: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        response: {
          result: evaluate(
            responseMinutes,
            policy?.responseTargetMinutes,
            Boolean(firstInvestigation)
          ),
          elapsedMinutes: Math.round(responseMinutes * 10) / 10,
          targetMinutes: policy?.responseTargetMinutes ?? null,
        },
        resolution: {
          result: evaluate(
            resolutionMinutes,
            policy?.resolutionTargetMinutes,
            isResolved
          ),
          elapsedMinutes: Math.round(resolutionMinutes * 10) / 10,
          targetMinutes: policy?.resolutionTargetMinutes ?? null,
        },
      };
    });

    return NextResponse.json({
      evaluatedAt: new Date(now).toISOString(),
      evaluatedCount: evaluations.length,
      limit: 200,
      evaluations,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to evaluate incident SLAs" },
      { status: 500 }
    );
  }
}
