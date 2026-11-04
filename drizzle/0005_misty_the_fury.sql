CREATE TABLE "sla_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"severity" "incident_severity" NOT NULL,
	"response_target_minutes" integer NOT NULL,
	"resolution_target_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sla_response_target_positive" CHECK ("sla_policies"."response_target_minutes" > 0),
	CONSTRAINT "sla_resolution_target_positive" CHECK ("sla_policies"."resolution_target_minutes" > 0)
);
--> statement-breakpoint
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sla_policies_org_severity_unique" ON "sla_policies" USING btree ("organization_id","severity");