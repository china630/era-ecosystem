-- Staff meal plan + slots/lines (Wave 3). ADR: docs/adr/fnb-buffet-cost-attribution.md

CREATE TABLE "buffet_staff_meal_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buffet_staff_meal_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "buffet_staff_meal_plan_slots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "meal" "BuffetMeal" NOT NULL,
    "covers_staff" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buffet_staff_meal_plan_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "buffet_staff_meal_plan_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "station" TEXT NOT NULL DEFAULT 'MAIN',
    "planned_portions" INTEGER NOT NULL,
    "waste_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buffet_staff_meal_plan_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "buffet_staff_meal_plans_organization_id_outlet_id_idx" ON "buffet_staff_meal_plans"("organization_id", "outlet_id");
CREATE UNIQUE INDEX "buffet_staff_meal_plan_slots_plan_id_weekday_meal_key" ON "buffet_staff_meal_plan_slots"("plan_id", "weekday", "meal");
CREATE INDEX "buffet_staff_meal_plan_slots_organization_id_idx" ON "buffet_staff_meal_plan_slots"("organization_id");
CREATE UNIQUE INDEX "buffet_staff_meal_plan_lines_slot_id_menu_item_id_station_key" ON "buffet_staff_meal_plan_lines"("slot_id", "menu_item_id", "station");
CREATE INDEX "buffet_staff_meal_plan_lines_organization_id_idx" ON "buffet_staff_meal_plan_lines"("organization_id");

ALTER TABLE "buffet_staff_meal_plans" ADD CONSTRAINT "buffet_staff_meal_plans_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buffet_staff_meal_plan_slots" ADD CONSTRAINT "buffet_staff_meal_plan_slots_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "buffet_staff_meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buffet_staff_meal_plan_lines" ADD CONSTRAINT "buffet_staff_meal_plan_lines_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "buffet_staff_meal_plan_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buffet_staff_meal_plan_lines" ADD CONSTRAINT "buffet_staff_meal_plan_lines_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
