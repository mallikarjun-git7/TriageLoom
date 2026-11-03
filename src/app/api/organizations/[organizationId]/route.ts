import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { organizations } from "@/db/schema";
import { requireOrganizationAccess } from "@/lib/organization-access";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ organizationId: string }>;
  }
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

  if (!access.ok) {
    return access.response;
  }

  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    organization: {
      ...organization,
      role: access.role,
    },
  });
}
