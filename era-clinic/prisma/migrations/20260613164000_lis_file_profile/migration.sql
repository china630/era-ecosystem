-- W3-3: LIS file import profiles

CREATE TYPE "LisFileFormat" AS ENUM ('CSV', 'HL7_FRAGMENT');

CREATE TABLE "LisFileProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" "LisFileFormat" NOT NULL DEFAULT 'CSV',
    "delimiter" TEXT NOT NULL DEFAULT ',',
    "columnMapping" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LisFileProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LisFileProfile_name_key" ON "LisFileProfile"("name");
