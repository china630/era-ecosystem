ALTER TABLE "Housekeeper" ADD COLUMN "department" "HkDepartment" NOT NULL DEFAULT 'ROOMS';
ALTER TABLE "Housekeeper" ADD COLUMN "pinShift" "HkRosterCellKind";
ALTER TABLE "Housekeeper" ADD COLUMN "egBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Housekeeper" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "HkFloorPair" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "floorLow" INTEGER NOT NULL,
  "floorHigh" INTEGER NOT NULL,
  CONSTRAINT "HkFloorPair_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HkFloorPair_organizationId_idx" ON "HkFloorPair"("organizationId");

CREATE TABLE "HkRosterWeek" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "weekStart" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HkRosterWeek_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HkRosterWeek_organizationId_weekStart_key" ON "HkRosterWeek"("organizationId", "weekStart");

CREATE TABLE "HkRosterCell" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "weekId" TEXT NOT NULL,
  "housekeeperId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "kind" "HkRosterCellKind" NOT NULL,
  "customStart" TEXT,
  "customEnd" TEXT,
  CONSTRAINT "HkRosterCell_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HkRosterCell_weekId_housekeeperId_workDate_key" ON "HkRosterCell"("weekId", "housekeeperId", "workDate");
CREATE INDEX "HkRosterCell_organizationId_idx" ON "HkRosterCell"("organizationId");
ALTER TABLE "HkRosterCell" ADD CONSTRAINT "HkRosterCell_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "HkRosterWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HkRosterCell" ADD CONSTRAINT "HkRosterCell_housekeeperId_fkey" FOREIGN KEY ("housekeeperId") REFERENCES "Housekeeper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HkRotationDay" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "shiftKind" "HkRosterCellKind" NOT NULL DEFAULT 'E',
  "housekeeperId" TEXT NOT NULL,
  "pairId" TEXT NOT NULL,
  CONSTRAINT "HkRotationDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HkRotationDay_org_date_shift_hk_key" ON "HkRotationDay"("organizationId", "workDate", "shiftKind", "housekeeperId");
ALTER TABLE "HkRotationDay" ADD CONSTRAINT "HkRotationDay_housekeeperId_fkey" FOREIGN KEY ("housekeeperId") REFERENCES "Housekeeper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HkRotationDay" ADD CONSTRAINT "HkRotationDay_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "HkFloorPair"("id") ON UPDATE CASCADE;

CREATE TABLE "HkEgLedger" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "housekeeperId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HkEgLedger_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "HkEgLedger" ADD CONSTRAINT "HkEgLedger_housekeeperId_fkey" FOREIGN KEY ("housekeeperId") REFERENCES "Housekeeper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LaundryItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENTLEMEN',
  "washPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "ironPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "LaundryItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LaundryItem_organizationId_code_key" ON "LaundryItem"("organizationId", "code");

CREATE TABLE "LaundryTicket" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "reservationId" TEXT,
  "guestName" TEXT NOT NULL,
  "service" TEXT NOT NULL DEFAULT 'REGULAR',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "express" BOOLEAN NOT NULL DEFAULT false,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "folioChargeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaundryTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LaundryTicketLine" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "guestQty" INTEGER NOT NULL DEFAULT 0,
  "hotelQty" INTEGER NOT NULL DEFAULT 0,
  "washQty" INTEGER NOT NULL DEFAULT 0,
  "ironQty" INTEGER NOT NULL DEFAULT 0,
  "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT "LaundryTicketLine_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "LaundryTicketLine" ADD CONSTRAINT "LaundryTicketLine_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "LaundryTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LaundryTicketLine" ADD CONSTRAINT "LaundryTicketLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LaundryItem"("id") ON UPDATE CASCADE;

CREATE TABLE "HkNsrDay" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  CONSTRAINT "HkNsrDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HkNsrDay_reservationId_workDate_key" ON "HkNsrDay"("reservationId", "workDate");

CREATE TABLE "HkDiscrepancy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HkDiscrepancy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HkHotelPolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "linenEveryNights" INTEGER NOT NULL DEFAULT 3,
  "deepEveryNights" INTEGER NOT NULL DEFAULT 5,
  CONSTRAINT "HkHotelPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HkHotelPolicy_organizationId_key" ON "HkHotelPolicy"("organizationId");
