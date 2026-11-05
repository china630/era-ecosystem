-- Department duty schedules (reception / security / engineering)
CREATE TYPE "DutyScheduleTypeCode" AS ENUM ('WEEK_ZONE', 'WEEK_POST', 'WEEK_CREW', 'WEEK_PERSON', 'MONTH_DUTY');
CREATE TYPE "DutyScheduleDept" AS ENUM ('HOUSEKEEPING', 'RECEPTION', 'SECURITY', 'ENGINEERING');
CREATE TYPE "DutyScheduleWeekStatus" AS ENUM ('DRAFT', 'APPROVED');

CREATE TABLE "DutyShiftCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DutyShiftCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DutyShiftCode_organizationId_code_key" ON "DutyShiftCode"("organizationId", "code");
CREATE INDEX "DutyShiftCode_organizationId_idx" ON "DutyShiftCode"("organizationId");

CREATE TABLE "DutyScheduleBinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dept" "DutyScheduleDept" NOT NULL,
    "typeCode" "DutyScheduleTypeCode" NOT NULL,
    "orgUnitIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "positionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DutyScheduleBinding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DutyScheduleBinding_organizationId_dept_key" ON "DutyScheduleBinding"("organizationId", "dept");
CREATE INDEX "DutyScheduleBinding_organizationId_idx" ON "DutyScheduleBinding"("organizationId");

CREATE TABLE "DutyScheduleAxis" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dept" "DutyScheduleDept" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'POST',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DutyScheduleAxis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DutyScheduleAxis_organizationId_dept_code_key" ON "DutyScheduleAxis"("organizationId", "dept", "code");
CREATE INDEX "DutyScheduleAxis_organizationId_dept_idx" ON "DutyScheduleAxis"("organizationId", "dept");

CREATE TABLE "DutyScheduleWeek" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dept" "DutyScheduleDept" NOT NULL,
    "weekStart" DATE NOT NULL,
    "status" "DutyScheduleWeekStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DutyScheduleWeek_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DutyScheduleWeek_organizationId_dept_weekStart_key" ON "DutyScheduleWeek"("organizationId", "dept", "weekStart");
CREATE INDEX "DutyScheduleWeek_organizationId_dept_idx" ON "DutyScheduleWeek"("organizationId", "dept");

CREATE TABLE "DutyScheduleCell" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "axisId" TEXT NOT NULL,
    "globalPersonId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "orgUnitId" TEXT,
    "orgUnitName" TEXT,
    "positionId" TEXT,
    "positionName" TEXT,
    "shiftCode" TEXT NOT NULL,
    "orphaned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DutyScheduleCell_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DutyScheduleCell_weekId_workDate_axisId_globalPersonId_key" ON "DutyScheduleCell"("weekId", "workDate", "axisId", "globalPersonId");
CREATE INDEX "DutyScheduleCell_organizationId_weekId_idx" ON "DutyScheduleCell"("organizationId", "weekId");
CREATE INDEX "DutyScheduleCell_organizationId_workDate_globalPersonId_idx" ON "DutyScheduleCell"("organizationId", "workDate", "globalPersonId");

ALTER TABLE "DutyScheduleCell" ADD CONSTRAINT "DutyScheduleCell_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "DutyScheduleWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyScheduleCell" ADD CONSTRAINT "DutyScheduleCell_axisId_fkey" FOREIGN KEY ("axisId") REFERENCES "DutyScheduleAxis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
