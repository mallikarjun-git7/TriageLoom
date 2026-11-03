import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { organizations, memberships } from "@/db/schema";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
});

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const result = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(
      organizations,
      eq(memberships.organizationId, organizations.id)
    )
    .where(eq(memberships.userId, session.user.id));

  return NextResponse.json({ organizations: result });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = organizationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid organization name or slug" },
      { status: 400 }
    );
  }

  try {
    const organization = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(organizations)
        .values(parsed.data)
        .returning();

      await tx.insert(memberships).values({
        organizationId: created.id,
        userId: session.user.id,
        role: "owner",
      });

      return created;
    });

    return NextResponse.json(
      {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          role: "owner",
        },
      },
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
        { error: "Organization slug already exists" },
        { status: 409 }
      );
    }

    console.error("Organization creation failed");

    return NextResponse.json(
      { error: "Unable to create organization" },
      { status: 500 }
    );
  }
}
