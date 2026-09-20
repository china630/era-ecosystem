-- Evrostar wave 2: labor roster primitives (places, shift types/cycles, brigades, assignments, day overrides)

CREATE TYPE "WorkforcePlaceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "WorkforceDayOverrideKind" AS ENUM ('DAY_OFF', 'EXTRA', 'SWAP');

CREATE TABLE "workforce_places" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" "WorkforcePlaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "responsible_org_unit_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workforce_places_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_shift_types" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_night" BOOLEAN NOT NULL DEFAULT false,
    "default_hours" DECIMAL(10,2) NOT NULL DEFAULT 8,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workforce_shift_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_shift_cycles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "cycle_anchor" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workforce_shift_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_shift_cycle_slots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "shift_type_id" UUID,
    CONSTRAINT "workforce_shift_cycle_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_brigades" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workforce_brigades_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_brigade_members" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "brigade_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workforce_brigade_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_shift_assignments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "place_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "employment_id" UUID,
    "brigade_id" UUID,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workforce_shift_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_day_overrides" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "kind" "WorkforceDayOverrideKind" NOT NULL,
    "place_id" UUID,
    "shift_type_id" UUID,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workforce_day_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workforce_places_organization_id_code_key" ON "workforce_places"("organization_id", "code");
CREATE INDEX "workforce_places_organization_id_status_idx" ON "workforce_places"("organization_id", "status");

CREATE UNIQUE INDEX "workforce_shift_types_organization_id_code_key" ON "workforce_shift_types"("organization_id", "code");
CREATE INDEX "workforce_shift_types_organization_id_idx" ON "workforce_shift_types"("organization_id");

CREATE UNIQUE INDEX "workforce_shift_cycles_organization_id_code_key" ON "workforce_shift_cycles"("organization_id", "code");
CREATE INDEX "workforce_shift_cycles_organization_id_idx" ON "workforce_shift_cycles"("organization_id");

CREATE UNIQUE INDEX "workforce_shift_cycle_slots_cycle_id_slot_index_key" ON "workforce_shift_cycle_slots"("cycle_id", "slot_index");
CREATE INDEX "workforce_shift_cycle_slots_organization_id_cycle_id_idx" ON "workforce_shift_cycle_slots"("organization_id", "cycle_id");

CREATE UNIQUE INDEX "workforce_brigades_organization_id_code_key" ON "workforce_brigades"("organization_id", "code");
CREATE INDEX "workforce_brigades_organization_id_idx" ON "workforce_brigades"("organization_id");

CREATE UNIQUE INDEX "workforce_brigade_members_brigade_id_employment_id_key" ON "workforce_brigade_members"("brigade_id", "employment_id");
CREATE INDEX "workforce_brigade_members_organization_id_employment_id_idx" ON "workforce_brigade_members"("organization_id", "employment_id");

CREATE INDEX "workforce_shift_assignments_organization_id_place_id_effective_from_idx" ON "workforce_shift_assignments"("organization_id", "place_id", "effective_from");
CREATE INDEX "workforce_shift_assignments_organization_id_employment_id_effective_from_idx" ON "workforce_shift_assignments"("organization_id", "employment_id", "effective_from");
CREATE INDEX "workforce_shift_assignments_organization_id_brigade_id_effective_from_idx" ON "workforce_shift_assignments"("organization_id", "brigade_id", "effective_from");

CREATE UNIQUE INDEX "workforce_day_overrides_employment_id_work_date_key" ON "workforce_day_overrides"("employment_id", "work_date");
CREATE INDEX "workforce_day_overrides_organization_id_work_date_idx" ON "workforce_day_overrides"("organization_id", "work_date");

ALTER TABLE "workforce_places" ADD CONSTRAINT "workforce_places_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_places" ADD CONSTRAINT "workforce_places_responsible_org_unit_id_fkey" FOREIGN KEY ("responsible_org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workforce_shift_types" ADD CONSTRAINT "workforce_shift_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workforce_shift_cycles" ADD CONSTRAINT "workforce_shift_cycles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workforce_shift_cycle_slots" ADD CONSTRAINT "workforce_shift_cycle_slots_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "workforce_shift_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_shift_cycle_slots" ADD CONSTRAINT "workforce_shift_cycle_slots_shift_type_id_fkey" FOREIGN KEY ("shift_type_id") REFERENCES "workforce_shift_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workforce_brigades" ADD CONSTRAINT "workforce_brigades_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workforce_brigade_members" ADD CONSTRAINT "workforce_brigade_members_brigade_id_fkey" FOREIGN KEY ("brigade_id") REFERENCES "workforce_brigades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_brigade_members" ADD CONSTRAINT "workforce_brigade_members_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workforce_shift_assignments" ADD CONSTRAINT "workforce_shift_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_shift_assignments" ADD CONSTRAINT "workforce_shift_assignments_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "workforce_places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workforce_shift_assignments" ADD CONSTRAINT "workforce_shift_assignments_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "workforce_shift_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workforce_shift_assignments" ADD CONSTRAINT "workforce_shift_assignments_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_shift_assignments" ADD CONSTRAINT "workforce_shift_assignments_brigade_id_fkey" FOREIGN KEY ("brigade_id") REFERENCES "workforce_brigades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workforce_day_overrides" ADD CONSTRAINT "workforce_day_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_day_overrides" ADD CONSTRAINT "workforce_day_overrides_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_day_overrides" ADD CONSTRAINT "workforce_day_overrides_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "workforce_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workforce_day_overrides" ADD CONSTRAINT "workforce_day_overrides_shift_type_id_fkey" FOREIGN KEY ("shift_type_id") REFERENCES "workforce_shift_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
