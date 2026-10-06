-- Login journal (no backfill) and per-org Baku-day extra-ticket receipt counter.

CREATE TABLE "user_logins" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_logins_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_logins_organizationId_created_at_idx" ON "user_logins"("organizationId", "created_at");
CREATE INDEX "user_logins_userId_idx" ON "user_logins"("userId");

ALTER TABLE "user_logins" ADD CONSTRAINT "user_logins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "clinic_receipt_seqs" (
    "organizationId" TEXT NOT NULL,
    "day_key" TEXT NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "clinic_receipt_seqs_pkey" PRIMARY KEY ("organizationId", "day_key")
);
