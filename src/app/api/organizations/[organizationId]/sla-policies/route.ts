import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { slaPolicies } from "@/db/schema";
import { requireOrganizationAccess } from "@/lib/organization-access";

type Context = {
  params: Promise<{ organizationId: string }>;
};

const policySchema = z.object({
  severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]),
  responseTargetMinutes: z.number().int().min(1).max(43200),
  resolutionTargetMinutes: z.number().int().min(1).max(43200),
}).strict().refine(
  (data) => data.resolutionTargetMinutes >= data.responseTargetMinutes,
  { message: "Resolution target must not be shorter than response target" }
);

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
    const policies = await db
      .select({
        severity: slaPolicies.severity,
        responseTargetMinutes: slaPolicies.responseTargetMinutes,
        resolutionTargetMinutes: slaPolicies.resolutionTargetMinutes,
        updatedAt: slaPolicies.updatedAt,
      })
      .from(slaPolicies)
      .where(eq(slaPolicies.organizationId, organizationId));

    return NextResponse.json({ policies });
  } catch {
    return NextResponse.json(
      { error: "Unable to load SLA policies" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    "sla:manage"
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

  const parsed = policySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ??
          "Invalid SLA policy",
      },
      { status: 400 }
    );
  }

  try {
    const [policy] = await db
      .insert(slaPolicies)
      .values({
        organizationId,
        ...parsed.data,
      })
      .onConflictDoUpdate({
        target: [slaPolicies.organizationId, slaPolicies.severity],
        set: {
          responseTargetMinutes: parsed.data.responseTargetMinutes,
          resolutionTargetMinutes: parsed.data.resolutionTargetMinutes,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ policy });
  } catch {
    return NextResponse.json(
      { error: "Unable to save SLA policy" },
      { status: 500 }
    );
  }
}
