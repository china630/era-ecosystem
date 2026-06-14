-- W3-2: reception queue tickets

CREATE TYPE "QueueTicketStatus" AS ENUM ('WAITING', 'CALLED', 'SERVED', 'SKIPPED');

CREATE TABLE "QueueTicket" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "queueNumber" INTEGER NOT NULL,
    "status" "QueueTicketStatus" NOT NULL DEFAULT 'WAITING',
    "desk" TEXT,
    "calledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QueueTicket_status_createdAt_idx" ON "QueueTicket"("status", "createdAt");
CREATE INDEX "QueueTicket_visitId_idx" ON "QueueTicket"("visitId");

ALTER TABLE "QueueTicket" ADD CONSTRAINT "QueueTicket_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
