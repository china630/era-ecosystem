-- Closed checks point at the shift whose drawer interval contains closed_at.
ALTER TABLE "tickets" ADD COLUMN "shift_id" TEXT;

UPDATE "tickets" AS t
SET "shift_id" = picked.id
FROM (
  SELECT DISTINCT ON (t2.id) t2.id AS ticket_id, s.id
  FROM "tickets" t2
  JOIN "pos_shifts" s
    ON s.outlet_id = t2.outlet_id
   AND t2.closed_at >= s.opened_at
   AND t2.closed_at <= COALESCE(s.closed_at, NOW()) + INTERVAL '1 second'
  WHERE t2.status = 'CLOSED'
    AND t2.closed_at IS NOT NULL
  ORDER BY t2.id, s.opened_at DESC
) AS picked
WHERE t.id = picked.ticket_id
  AND t.shift_id IS NULL;

ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "pos_shifts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tickets_shift_id_idx" ON "tickets"("shift_id");
