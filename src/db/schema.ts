import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  primaryKey,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";

export const memberRole = pgEnum("member_role", [
  "owner",
  "admin",
  "responder",
  "viewer",
]);

export const incidentSeverity = pgEnum("incident_severity", [
  "SEV1",
  "SEV2",
  "SEV3",
  "SEV4",
]);

export const incidentStatus = pgEnum("incident_status", [
  "open",
  "investigating",
  "mitigating",
  "resolved",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const memberships = pgTable(
  "memberships",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: memberRole("role").default("viewer").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index("memberships_user_idx").on(table.userId),
  ]
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("services_organization_idx").on(table.organizationId),
    uniqueIndex("services_org_name_unique").on(
      table.organizationId,
      table.name
    ),
    uniqueIndex("services_org_id_unique").on(
      table.organizationId,
      table.id
    ),
  ]
);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    serviceId: uuid("service_id"),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    severity: incidentSeverity("severity").notNull(),
    status: incidentStatus("status").default("open").notNull(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    assignedToId: uuid("assigned_to_id")
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("incidents_org_status_idx").on(
      table.organizationId,
      table.status
    ),
    index("incidents_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    uniqueIndex("incidents_org_id_unique").on(
      table.organizationId,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.createdById],
      foreignColumns: [memberships.organizationId, memberships.userId],
      name: "incidents_creator_membership_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.assignedToId],
      foreignColumns: [memberships.organizationId, memberships.userId],
      name: "incidents_assignee_membership_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.serviceId],
      foreignColumns: [services.organizationId, services.id],
      name: "incidents_service_tenant_fk",
    }),
  ]
);

export const incidentEvents = pgTable(
  "incident_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id),
    actorId: uuid("actor_id").references(() => users.id),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("incident_events_incident_idx").on(
      table.incidentId,
      table.createdAt
    ),
    index("incident_events_org_idx").on(table.organizationId),
    foreignKey({
      columns: [table.organizationId, table.incidentId],
      foreignColumns: [incidents.organizationId, incidents.id],
      name: "incident_events_tenant_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.actorId],
      foreignColumns: [memberships.organizationId, memberships.userId],
      name: "incident_events_actor_membership_fk",
    }),
  ]
);

// Better Auth: persistent user sessions.
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Better Auth: email/password and linked provider accounts.
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Better Auth: temporary verification records.
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
