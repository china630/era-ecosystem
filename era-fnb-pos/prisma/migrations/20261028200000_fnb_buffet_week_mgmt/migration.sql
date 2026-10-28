-- Buffet weekly template + management meal log (Wave 2).
-- ADR: docs/adr/fnb-buffet-cost-attribution.md

CREATE TABLE "buffet_week_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buffet_week_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "buffet_week_template_slots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "meal" "BuffetMeal" NOT NULL,
    "covers_adult" INTEGER NOT NULL DEFAULT 0,
    "covers_child" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buffet_week_template_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "buffet_week_template_lines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "station" TEXT NOT NULL DEFAULT 'MAIN',
    "planned_portions" INTEGER NOT NULL,
    "waste_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buffet_week_template_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "buffet_management_meals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "service_date" DATE NOT NULL,
    "meal" "BuffetMeal" NOT NULL,
    "actor_label" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signed_by_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buffet_management_meals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "buffet_week_templates_organization_id_outlet_id_idx" ON "buffet_week_templates"("organization_id", "outlet_id");
CREATE UNIQUE INDEX "buffet_week_template_slots_template_id_weekday_meal_key" ON "buffet_week_template_slots"("template_id", "weekday", "meal");
CREATE INDEX "buffet_week_template_slots_organization_id_idx" ON "buffet_week_template_slots"("organization_id");
CREATE UNIQUE INDEX "buffet_week_template_lines_slot_id_menu_item_id_station_key" ON "buffet_week_template_lines"("slot_id", "menu_item_id", "station");
CREATE INDEX "buffet_week_template_lines_organization_id_idx" ON "buffet_week_template_lines"("organization_id");
CREATE UNIQUE INDEX "buffet_management_meals_outlet_id_service_date_meal_actor_label_key" ON "buffet_management_meals"("outlet_id", "service_date", "meal", "actor_label");
CREATE INDEX "buffet_management_meals_organization_id_outlet_id_service_date_idx" ON "buffet_management_meals"("organization_id", "outlet_id", "service_date");

ALTER TABLE "buffet_week_templates" ADD CONSTRAINT "buffet_week_templates_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buffet_week_template_slots" ADD CONSTRAINT "buffet_week_template_slots_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "buffet_week_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buffet_week_template_lines" ADD CONSTRAINT "buffet_week_template_lines_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "buffet_week_template_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buffet_week_template_lines" ADD CONSTRAINT "buffet_week_template_lines_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "buffet_management_meals" ADD CONSTRAINT "buffet_management_meals_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
