CREATE TABLE "ProductCategory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "revenue_code" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductCategory_organizationId_code_key" ON "ProductCategory"("organizationId", "code");
CREATE INDEX "ProductCategory_organizationId_idx" ON "ProductCategory"("organizationId");

ALTER TABLE "ProductCache" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "ProductCache_categoryId_idx" ON "ProductCache"("categoryId");
ALTER TABLE "ProductCache"
  ADD CONSTRAINT "ProductCache_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
