-- CP-DOC-01 organization document register and linear approval route.

CREATE TYPE "DocKind" AS ENUM ('INCOMING', 'OUTGOING', 'INTERNAL');
CREATE TYPE "DocStatus" AS ENUM ('DRAFT', 'REGISTERED', 'IN_ROUTE', 'COMPLETED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "DocLocationKind" AS ENUM ('SITE', 'ROOM', 'RACK', 'SHELF', 'BOX', 'FOLDER');
CREATE TYPE "DocStepAction" AS ENUM ('APPROVE', 'SIGN', 'EXECUTE', 'ACKNOWLEDGE');
CREATE TYPE "DocRouteInstanceStatus" AS ENUM ('OPEN', 'COMPLETED', 'REJECTED');
CREATE TYPE "DocTaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');
CREATE TYPE "DocDecisionOutcome" AS ENUM ('APPROVED', 'REJECTED', 'ACKNOWLEDGED');

CREATE TABLE "doc_locations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "parent_id" UUID,
    "kind" "DocLocationKind" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_route_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "doc_kind" "DocKind" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "doc_route_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_route_steps" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "template_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "kind" "WorkforceApprovalStepKind" NOT NULL,
    "action" "DocStepAction" NOT NULL,
    "applies_to" "WorkforceApprovalStepAudience" NOT NULL DEFAULT 'ALWAYS',
    "due_days" INTEGER NOT NULL DEFAULT 3,
    "chain_offset" INTEGER,
    "min_grade_level" INTEGER,
    "org_unit_id" UUID,
    "position_id" UUID,
    CONSTRAINT "doc_route_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_cases" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "kind" "DocKind" NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "reg_number" VARCHAR(32),
    "registered_at" TIMESTAMPTZ(6),
    "title" VARCHAR(500) NOT NULL,
    "correspondent" VARCHAR(500),
    "summary" TEXT,
    "due_on" DATE,
    "org_unit_id" UUID,
    "reply_to_id" UUID,
    "author_employment_id" UUID NOT NULL,
    "location_id" UUID,
    "template_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "doc_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_files" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "case_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(128) NOT NULL DEFAULT 'text/plain',
    "body" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_route_instances" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "status" "DocRouteInstanceStatus" NOT NULL DEFAULT 'OPEN',
    "current_step" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "doc_route_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_route_tasks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "instance_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "action" "DocStepAction" NOT NULL,
    "status" "DocTaskStatus" NOT NULL DEFAULT 'OPEN',
    "assignee_employment_id" UUID NOT NULL,
    "assignee_user_id" UUID,
    "due_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_route_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_route_decisions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "instance_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "outcome" "DocDecisionOutcome" NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_route_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_cases_organization_id_reg_number_key" ON "doc_cases"("organization_id", "reg_number");
CREATE INDEX "doc_cases_organization_id_status_kind_idx" ON "doc_cases"("organization_id", "status", "kind");
CREATE INDEX "doc_locations_organization_id_parent_id_idx" ON "doc_locations"("organization_id", "parent_id");
CREATE INDEX "doc_route_templates_organization_id_doc_kind_idx" ON "doc_route_templates"("organization_id", "doc_kind");
CREATE UNIQUE INDEX "doc_route_steps_template_id_step_order_key" ON "doc_route_steps"("template_id", "step_order");
CREATE UNIQUE INDEX "doc_route_instances_case_id_key" ON "doc_route_instances"("case_id");
CREATE INDEX "doc_route_instances_organization_id_status_idx" ON "doc_route_instances"("organization_id", "status");
CREATE INDEX "doc_files_case_id_idx" ON "doc_files"("case_id");
CREATE INDEX "doc_route_tasks_assignee_user_id_status_idx" ON "doc_route_tasks"("assignee_user_id", "status");
CREATE INDEX "doc_route_tasks_instance_id_step_order_idx" ON "doc_route_tasks"("instance_id", "step_order");
CREATE INDEX "doc_route_decisions_instance_id_created_at_idx" ON "doc_route_decisions"("instance_id", "created_at");

ALTER TABLE "doc_locations" ADD CONSTRAINT "doc_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_locations" ADD CONSTRAINT "doc_locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "doc_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_route_templates" ADD CONSTRAINT "doc_route_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_route_steps" ADD CONSTRAINT "doc_route_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "doc_route_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_cases" ADD CONSTRAINT "doc_cases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_cases" ADD CONSTRAINT "doc_cases_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "doc_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doc_cases" ADD CONSTRAINT "doc_cases_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "doc_route_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doc_cases" ADD CONSTRAINT "doc_cases_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "doc_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doc_files" ADD CONSTRAINT "doc_files_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "doc_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_route_instances" ADD CONSTRAINT "doc_route_instances_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "doc_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_route_instances" ADD CONSTRAINT "doc_route_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "doc_route_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_route_tasks" ADD CONSTRAINT "doc_route_tasks_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "doc_route_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_route_decisions" ADD CONSTRAINT "doc_route_decisions_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "doc_route_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
