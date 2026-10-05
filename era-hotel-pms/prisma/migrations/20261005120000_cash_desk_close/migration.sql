-- Front cash day row close (department × tender). No open-shift gate.
CREATE TABLE "CashDeskClose" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "payingDepartment" TEXT NOT NULL,
    "tender" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashDeskClose_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashDeskClose_organizationId_businessDate_payingDepartment_tender_key"
  ON "CashDeskClose"("organizationId", "businessDate", "payingDepartment", "tender");
CREATE INDEX "CashDeskClose_organizationId_idx" ON "CashDeskClose"("organizationId");
