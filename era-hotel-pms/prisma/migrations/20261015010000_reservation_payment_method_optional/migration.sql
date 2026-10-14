-- Reservation tender is optional. An empty desk field stays unset; no cash/card default.
ALTER TABLE "Reservation" ALTER COLUMN "paymentMethod" DROP NOT NULL;
