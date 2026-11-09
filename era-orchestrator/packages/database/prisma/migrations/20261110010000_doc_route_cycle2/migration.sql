-- CP-DOC-01 cycle 2: join, skip, amount, manual assign, overdue stamp.

CREATE TYPE "DocStepJoin" AS ENUM ('ANY', 'ALL');

ALTER TABLE "doc_route_steps" ADD COLUMN "join" "DocStepJoin" NOT NULL DEFAULT 'ANY';
ALTER TABLE "doc_route_steps" ADD COLUMN "skip_unless_kind" "DocKind";
ALTER TABLE "doc_route_steps" ADD COLUMN "min_amount" DECIMAL(19,4);

ALTER TABLE "doc_cases" ADD COLUMN "amount" DECIMAL(19,4);

ALTER TABLE "doc_route_instances" ADD COLUMN "awaiting_assignment" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "doc_route_tasks" ADD COLUMN "overdue_notified_at" TIMESTAMPTZ(6);
