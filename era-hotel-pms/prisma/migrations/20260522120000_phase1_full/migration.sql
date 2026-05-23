-- ERA Hotel PMS — full phase-1 schema (single source of truth)

CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'DIRTY', 'CLEAN', 'INSPECTED', 'OOO', 'OOS', 'MAINTENANCE');
CREATE TYPE "ReservationStatus" AS ENUM ('OPTION', 'CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'COMPANY_ACCOUNT');
CREATE TYPE "FolioType" AS ENUM ('GUEST', 'COMPANY', 'AGENCY');
CREATE TYPE "FolioStatus" AS ENUM ('OPEN', 'CLOSED', 'VOID');
CREATE TYPE "BusinessDayStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "NightAuditStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "OutboundEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "CashShiftStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "HousekeepingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');
CREATE TYPE "ChannelErrorStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "MedicalOrderStatus" AS ENUM ('PENDING', 'COMPLETED');
CREATE TYPE "LabResultFlag" AS ENUM ('NORMAL', 'HIGH', 'LOW');

CREATE TABLE "HotelProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Baku',
    "propertyCode" TEXT NOT NULL,
    "roomCapacity" INTEGER NOT NULL DEFAULT 78,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelProfile_propertyCode_key" ON "HotelProfile"("propertyCode");

CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adultCapacity" INTEGER NOT NULL DEFAULT 2,
    "childCapacity" INTEGER NOT NULL DEFAULT 0,
    "baseQuota" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomType_code_key" ON "RoomType"("code");

CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MealPlan_code_key" ON "MealPlan"("code");

CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

CREATE TABLE "RevenueCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxTag" TEXT,
    "departmentId" TEXT,
    CONSTRAINT "RevenueCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RevenueCode_code_key" ON "RevenueCode"("code");

CREATE TABLE "RatePlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "medicalFlag" BOOLEAN NOT NULL DEFAULT false,
    "pricePerNight" DECIMAL(12,2) NOT NULL,
    "roomTypeId" TEXT,
    "mealPlanId" TEXT,
    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RatePlan_code_key" ON "RatePlan"("code");

CREATE TABLE "BookingSource" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "BookingSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingSource_code_key" ON "BookingSource"("code");

CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "voen" TEXT,
    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Agency_code_key" ON "Agency"("code");

CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Room_roomNumber_key" ON "Room"("roomNumber");

CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "voen" TEXT,
    "passportNumber" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "roomId" TEXT,
    "guestId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "mealPlanId" TEXT,
    "sourceId" TEXT,
    "agencyId" TEXT,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");
CREATE INDEX "Reservation_roomId_idx" ON "Reservation"("roomId");
CREATE INDEX "Reservation_guestId_idx" ON "Reservation"("guestId");
CREATE INDEX "Reservation_roomTypeId_idx" ON "Reservation"("roomTypeId");

CREATE TABLE "Stay" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "actualCheckIn" TIMESTAMP(3) NOT NULL,
    "actualCheckOut" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Stay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Stay_reservationId_key" ON "Stay"("reservationId");

CREATE TABLE "Folio" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "type" "FolioType" NOT NULL,
    "status" "FolioStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Folio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Folio_reservationId_idx" ON "Folio"("reservationId");

CREATE TABLE "FolioRoutingRule" (
    "id" TEXT NOT NULL,
    "revenueCodeId" TEXT NOT NULL,
    "targetFolioType" "FolioType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FolioRoutingRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FolioRoutingRule_revenueCodeId_key" ON "FolioRoutingRule"("revenueCodeId");

CREATE TABLE "FolioCharge" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "revenueCodeId" TEXT NOT NULL,
    "departmentId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FolioCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FolioPayment" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "registerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FolioPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashShift" (
    "id" TEXT NOT NULL,
    "cashier" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "status" "CashShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "BusinessDayStatus" NOT NULL DEFAULT 'OPEN',
    CONSTRAINT "BusinessDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessDay_date_key" ON "BusinessDay"("date");

CREATE TABLE "NightAuditRun" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "status" "NightAuditStatus" NOT NULL DEFAULT 'RUNNING',
    "stepsJson" TEXT,
    "errorsJson" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NightAuditRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HousekeepingTask" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "HousekeepingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HousekeepingTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelSyncError" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "otaReference" TEXT,
    "errorMessage" TEXT NOT NULL,
    "status" "ChannelErrorStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelSyncError_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicalAlert" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "reservationId" TEXT,
    "temperature" DECIMAL(4,1),
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicalAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicalOrder" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "status" "MedicalOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicalOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "medicalOrderId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "resultValue" TEXT NOT NULL,
    "flag" "LabResultFlag" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicalProcedure" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "MedicalProcedure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboundEventLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" "OutboundEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutboundEventLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RevenueCode" ADD CONSTRAINT "RevenueCode_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BookingSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioRoutingRule" ADD CONSTRAINT "FolioRoutingRule_revenueCodeId_fkey" FOREIGN KEY ("revenueCodeId") REFERENCES "RevenueCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_revenueCodeId_fkey" FOREIGN KEY ("revenueCodeId") REFERENCES "RevenueCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FolioPayment" ADD CONSTRAINT "FolioPayment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NightAuditRun" ADD CONSTRAINT "NightAuditRun_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "BusinessDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannelSyncError" ADD CONSTRAINT "ChannelSyncError_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicalAlert" ADD CONSTRAINT "MedicalAlert_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicalAlert" ADD CONSTRAINT "MedicalAlert_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicalOrder" ADD CONSTRAINT "MedicalOrder_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_medicalOrderId_fkey" FOREIGN KEY ("medicalOrderId") REFERENCES "MedicalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
