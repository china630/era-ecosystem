CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RFQ', 'ORDERED', 'CLOSED');
CREATE TYPE "PurchaseRequestApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

CREATE TABLE "purchase_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "department_id" UUID,
    "requester_user_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "needed_by_date" DATE,
    "preferred_counterparty_id" UUID,
    "purchase_transaction_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_request_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "purchase_request_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4),
    "unit" TEXT,
    "unit_price" DECIMAL(19,4),
    "amount" DECIMAL(19,4),
    "product_id" UUID,

    CONSTRAINT "purchase_request_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_request_approvals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "purchase_request_id" UUID NOT NULL,
    "approver_user_id" UUID NOT NULL,
    "decision" "PurchaseRequestApprovalDecision" NOT NULL,
    "comment" TEXT,
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_request_approvals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchase_requests_purchase_transaction_id_key" ON "purchase_requests"("purchase_transaction_id");
CREATE UNIQUE INDEX "purchase_requests_organization_id_number_key" ON "purchase_requests"("organization_id", "number");
CREATE INDEX "purchase_requests_organization_id_status_created_at_idx" ON "purchase_requests"("organization_id", "status", "created_at" DESC);
CREATE INDEX "purchase_requests_organization_id_department_id_idx" ON "purchase_requests"("organization_id", "department_id");

CREATE UNIQUE INDEX "purchase_request_lines_purchase_request_id_line_no_key" ON "purchase_request_lines"("purchase_request_id", "line_no");
CREATE INDEX "purchase_request_lines_purchase_request_id_line_no_idx" ON "purchase_request_lines"("purchase_request_id", "line_no");

CREATE INDEX "purchase_request_approvals_purchase_request_id_decided_at_idx" ON "purchase_request_approvals"("purchase_request_id", "decided_at" DESC);

ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_preferred_counterparty_id_fkey" FOREIGN KEY ("preferred_counterparty_id") REFERENCES "counterparties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_purchase_transaction_id_fkey" FOREIGN KEY ("purchase_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_request_approvals" ADD CONSTRAINT "purchase_request_approvals_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_request_approvals" ADD CONSTRAINT "purchase_request_approvals_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
