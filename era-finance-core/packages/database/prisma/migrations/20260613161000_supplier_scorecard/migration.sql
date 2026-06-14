CREATE TABLE "supplier_scorecards" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "counterparty_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "period_label" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_scorecards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_scorecard_criteria" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "scorecard_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "weight" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "supplier_scorecard_criteria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_ratings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "counterparty_id" UUID NOT NULL,
    "scorecard_id" UUID NOT NULL,
    "criterion_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "period_label" TEXT,
    "notes" TEXT,
    "rated_by_user_id" UUID NOT NULL,
    "rated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_ratings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_scorecards_organization_id_counterparty_id_created_at_idx" ON "supplier_scorecards"("organization_id", "counterparty_id", "created_at" DESC);
CREATE INDEX "supplier_scorecard_criteria_scorecard_id_sort_order_idx" ON "supplier_scorecard_criteria"("scorecard_id", "sort_order");
CREATE UNIQUE INDEX "supplier_ratings_scorecard_id_criterion_id_period_label_key" ON "supplier_ratings"("scorecard_id", "criterion_id", "period_label");
CREATE INDEX "supplier_ratings_organization_id_counterparty_id_rated_at_idx" ON "supplier_ratings"("organization_id", "counterparty_id", "rated_at" DESC);

ALTER TABLE "supplier_scorecards" ADD CONSTRAINT "supplier_scorecards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_scorecards" ADD CONSTRAINT "supplier_scorecards_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_scorecard_criteria" ADD CONSTRAINT "supplier_scorecard_criteria_scorecard_id_fkey" FOREIGN KEY ("scorecard_id") REFERENCES "supplier_scorecards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_ratings" ADD CONSTRAINT "supplier_ratings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_ratings" ADD CONSTRAINT "supplier_ratings_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_ratings" ADD CONSTRAINT "supplier_ratings_scorecard_id_fkey" FOREIGN KEY ("scorecard_id") REFERENCES "supplier_scorecards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_ratings" ADD CONSTRAINT "supplier_ratings_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "supplier_scorecard_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_ratings" ADD CONSTRAINT "supplier_ratings_rated_by_user_id_fkey" FOREIGN KEY ("rated_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
