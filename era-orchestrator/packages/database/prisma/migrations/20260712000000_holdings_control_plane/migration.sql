-- CreateEnum
CREATE TYPE "HoldingAccessRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER');

-- CreateTable
CREATE TABLE "holdings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "base_currency" VARCHAR(3) NOT NULL DEFAULT 'AZN',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holding_memberships" (
    "user_id" UUID NOT NULL,
    "holding_id" UUID NOT NULL,
    "role" "HoldingAccessRole" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holding_memberships_pkey" PRIMARY KEY ("user_id","holding_id")
);

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "holding_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "holdings_name_key" ON "holdings"("name");

-- CreateIndex
CREATE INDEX "holdings_owner_id_idx" ON "holdings"("owner_id");

-- CreateIndex
CREATE INDEX "holding_memberships_holding_id_idx" ON "holding_memberships"("holding_id");

-- CreateIndex
CREATE INDEX "organizations_holding_id_idx" ON "organizations"("holding_id");

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_memberships" ADD CONSTRAINT "holding_memberships_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_memberships" ADD CONSTRAINT "holding_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
