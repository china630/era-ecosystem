-- Buffet Planner module (fnb_buffet_planner). ADR: docs/adr/fnb-buffet-planner.md

CREATE TYPE "BuffetMeal" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');
CREATE TYPE "BuffetPlanStatus" AS ENUM ('DRAFT', 'LOCKED', 'SERVED', 'CLOSED');
CREATE TYPE "BuffetCoversSource" AS ENUM ('MANUAL', 'HOTEL', 'MIXED');

CREATE TABLE "buffet_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "service_date" DATE NOT NULL,
    "meal" "BuffetMeal" NOT NULL,
    "status" "BuffetPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "covers_adult" INTEGER NOT NULL DEFAULT 0,
    "covers_child" INTEGER NOT NULL DEFAULT 0,
    "covers_source" "BuffetCoversSource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buffet_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "buffet_plan_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "station" TEXT NOT NULL DEFAULT 'MAIN',
    "planned_portions" INTEGER NOT NULL,
    "waste_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buffet_plan_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "buffet_plans_outlet_id_service_date_meal_key" ON "buffet_plans"("outlet_id", "service_date", "meal");
CREATE INDEX "buffet_plans_organization_id_service_date_idx" ON "buffet_plans"("organization_id", "service_date");
CREATE UNIQUE INDEX "buffet_plan_lines_plan_id_menu_item_id_station_key" ON "buffet_plan_lines"("plan_id", "menu_item_id", "station");
CREATE INDEX "buffet_plan_lines_organization_id_idx" ON "buffet_plan_lines"("organization_id");

ALTER TABLE "buffet_plans" ADD CONSTRAINT "buffet_plans_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buffet_plan_lines" ADD CONSTRAINT "buffet_plan_lines_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "buffet_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buffet_plan_lines" ADD CONSTRAINT "buffet_plan_lines_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
