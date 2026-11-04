CREATE TABLE "service_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"dependent_service_id" uuid NOT NULL,
	"dependency_service_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_dependencies_no_self_reference" CHECK ("service_dependencies"."dependent_service_id" <> "service_dependencies"."dependency_service_id")
);
--> statement-breakpoint
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_dependent_fk" FOREIGN KEY ("organization_id","dependent_service_id") REFERENCES "public"."services"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_dependency_fk" FOREIGN KEY ("organization_id","dependency_service_id") REFERENCES "public"."services"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_dependencies_unique" ON "service_dependencies" USING btree ("organization_id","dependent_service_id","dependency_service_id");--> statement-breakpoint
CREATE INDEX "service_dependencies_dependency_idx" ON "service_dependencies" USING btree ("organization_id","dependency_service_id");