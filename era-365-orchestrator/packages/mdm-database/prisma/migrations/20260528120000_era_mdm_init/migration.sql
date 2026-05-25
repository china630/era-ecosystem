CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE "PersonAccessRequestStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED');

CREATE TABLE "global_natural_persons" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "fin_blind_index" TEXT,
    "fin_cipher" TEXT,
    "full_name_cipher" TEXT,
    "phone_cipher" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "global_natural_persons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "global_legal_entities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tax_id_blind_index" TEXT NOT NULL,
    "tax_id_cipher" TEXT NOT NULL,
    "name_cipher" TEXT NOT NULL,
    "organization_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "global_legal_entities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "person_access_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "person_id" UUID NOT NULL,
    "requester_org_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "PersonAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),
    CONSTRAINT "person_access_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "person_access_grants" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "person_id" UUID NOT NULL,
    "grantee_org_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    CONSTRAINT "person_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "person_access_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "person_id" UUID NOT NULL,
    "actor_org_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "meta_json" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "person_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "global_natural_persons_fin_blind_index_key" ON "global_natural_persons"("fin_blind_index");
CREATE UNIQUE INDEX "global_legal_entities_tax_id_blind_index_key" ON "global_legal_entities"("tax_id_blind_index");
CREATE UNIQUE INDEX "global_legal_entities_organization_id_key" ON "global_legal_entities"("organization_id");
CREATE INDEX "person_access_requests_requester_org_id_status_idx" ON "person_access_requests"("requester_org_id", "status");
CREATE UNIQUE INDEX "person_access_grants_person_id_grantee_org_id_key" ON "person_access_grants"("person_id", "grantee_org_id");
CREATE INDEX "person_access_logs_person_id_created_at_idx" ON "person_access_logs"("person_id", "created_at");

ALTER TABLE "person_access_requests" ADD CONSTRAINT "person_access_requests_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "global_natural_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_access_grants" ADD CONSTRAINT "person_access_grants_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "global_natural_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_access_logs" ADD CONSTRAINT "person_access_logs_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "global_natural_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
