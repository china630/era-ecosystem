-- Partial unique: one ISSUED grant per (org, codeHash). Consumed/void/expired may reuse hash historically.
CREATE UNIQUE INDEX IF NOT EXISTS "trade_credit_grants_org_code_hash_issued_uidx"
    ON "trade_credit_grants"("organization_id", "code_hash")
    WHERE "status" = 'ISSUED';
