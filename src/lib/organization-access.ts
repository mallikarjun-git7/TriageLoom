import "server-only";

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { memberships } from "@/db/schema";

type Role = typeof memberships.$inferSelect.role;

const permissions = {
  "organization:read": ["owner", "admin", "responder", "viewer"],
  "incident:read": ["owner", "admin", "responder", "viewer"],
  "incident:create": ["owner", "admin", "responder"],
  "incident:update": ["owner", "admin", "responder"],
  "members:manage": ["owner", "admin"],
  "organization:delete": ["owner"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;

export async function requireOrganizationAccess(
  organizationId: string,
  permission: Permission
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const [membership] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.userId, session.user.id)
      )
    )
    .limit(1);

  if (!membership) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      ),
    };
  }

  const allowed: readonly Role[] = permissions[permission];

  if (!allowed.includes(membership.role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    userId: session.user.id,
    role: membership.role,
    organizationId,
  };
}
