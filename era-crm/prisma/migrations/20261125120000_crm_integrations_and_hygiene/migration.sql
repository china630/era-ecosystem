-- CRM integrations layer + product hygiene (tasks, pipelines, activities, scope helpers)
-- Generated for ADR docs/adr/crm/01-integrations-architecture.md

CREATE TYPE "IntegrationCategory" AS ENUM ('MESSENGER', 'SMS', 'EMAIL', 'TELEPHONY', 'LEAD_FORM', 'WEB_CHAT', 'CALENDAR', 'ANALYTICS', 'ADS', 'PAYMENT', 'AI', 'STORAGE', 'OTHER');
CREATE TYPE "IntegrationStatus" AS ENUM ('DRAFT', 'TESTING', 'ACTIVE', 'ERROR', 'DISABLED');
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED');
CREATE TYPE "MessageDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ANSWERED', 'COMPLETED', 'MISSED', 'BUSY', 'FAILED', 'NO_ANSWER');
CREATE TYPE "PipelineStageKind" AS ENUM ('OPEN', 'WON', 'LOST');

ALTER TYPE "CrmLookupKind" ADD VALUE IF NOT EXISTS 'TASK_TYPE';

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "is_unsorted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "pipeline_id" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "stage_id" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "custom_json" TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "IntegrationConnection" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "provider_key" TEXT NOT NULL,
  "category" "IntegrationCategory" NOT NULL,
  "display_name" TEXT NOT NULL,
  "public_id" TEXT NOT NULL UNIQUE,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'DRAFT',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config_json" TEXT NOT NULL DEFAULT '{}',
  "secrets_enc" TEXT,
  "secrets_key_ver" INTEGER NOT NULL DEFAULT 1,
  "webhook_secret" TEXT,
  "scopes_json" TEXT NOT NULL DEFAULT '[]',
  "oauth_expires_at" TIMESTAMP(3),
  "last_test_at" TIMESTAMP(3),
  "last_test_ok" BOOLEAN,
  "last_error" TEXT,
  "last_event_at" TIMESTAMP(3),
  "rate_limit_json" TEXT NOT NULL DEFAULT '{}',
  "default_owner_id" TEXT,
  "routing_json" TEXT NOT NULL DEFAULT '{}',
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Conversation" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "external_chat_id" TEXT NOT NULL,
  "contact_name" TEXT,
  "contact_phone" TEXT,
  "contact_handle" TEXT,
  "lead_id" TEXT,
  "assignee_id" TEXT,
  "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
  "unread_count" INTEGER NOT NULL DEFAULT 0,
  "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_inbound_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Conversation_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_connection_id_external_chat_id_key" ON "Conversation"("connection_id", "external_chat_id");

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "direction" "MessageDirection" NOT NULL,
  "type" TEXT NOT NULL,
  "text" TEXT,
  "media_key" TEXT,
  "media_mime" TEXT,
  "template_name" TEXT,
  "payload_json" TEXT NOT NULL DEFAULT '{}',
  "external_id" TEXT,
  "status" "MessageStatus" NOT NULL,
  "error" TEXT,
  "author_user_id" TEXT,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Message_conversation_id_external_id_key" ON "Message"("conversation_id", "external_id");

CREATE TABLE IF NOT EXISTS "Call" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "external_call_id" TEXT NOT NULL,
  "direction" "CallDirection" NOT NULL,
  "status" "CallStatus" NOT NULL,
  "from_number" TEXT,
  "to_number" TEXT,
  "extension" TEXT,
  "user_id" TEXT,
  "lead_id" TEXT,
  "started_at" TIMESTAMP(3),
  "answered_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "duration_sec" INTEGER,
  "talk_sec" INTEGER,
  "recording_url" TEXT,
  "recording_key" TEXT,
  "transcript" TEXT,
  "raw_json" TEXT NOT NULL DEFAULT '{}',
  CONSTRAINT "Call_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Call_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Call_connection_id_external_call_id_key" ON "Call"("connection_id", "external_call_id");

CREATE TABLE IF NOT EXISTS "InboundEvent" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "event_type" TEXT,
  "headers_json" TEXT NOT NULL DEFAULT '{}',
  "raw_body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "error" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "InboundEvent_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "InboundEvent_connection_id_idempotency_key_key" ON "InboundEvent"("connection_id", "idempotency_key");

CREATE TABLE IF NOT EXISTS "IntegrationOutbox" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_json" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" TEXT,
  "result_json" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationOutbox_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationOutbox_connection_id_idempotency_key_key" ON "IntegrationOutbox"("connection_id", "idempotency_key");

CREATE TABLE IF NOT EXISTS "UserTelephonyExtension" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  CONSTRAINT "UserTelephonyExtension_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserTelephonyExtension_connection_id_extension_key" ON "UserTelephonyExtension"("connection_id", "extension");

CREATE TABLE IF NOT EXISTS "Pipeline" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PipelineStage" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "pipeline_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT,
  "kind" "PipelineStageKind" NOT NULL DEFAULT 'OPEN',
  "required_fields_json" TEXT NOT NULL DEFAULT '[]',
  "legacy_stage" "LeadStage",
  CONSTRAINT "PipelineStage_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Task" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "lead_id" TEXT,
  "assignee_id" TEXT,
  "type" TEXT NOT NULL DEFAULT 'FOLLOW_UP',
  "title" TEXT NOT NULL,
  "due_at" TIMESTAMP(3),
  "done_at" TIMESTAMP(3),
  "result" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Activity" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "lead_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload_json" TEXT NOT NULL DEFAULT '{}',
  "author_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Activity_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UserGroup" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserGroup_organization_id_name_key" ON "UserGroup"("organization_id", "name");

CREATE TABLE IF NOT EXISTS "UserGroupMember" (
  "id" TEXT PRIMARY KEY,
  "group_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "UserGroupMember_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserGroupMember_group_id_user_id_key" ON "UserGroupMember"("group_id", "user_id");

CREATE TABLE IF NOT EXISTS "Tag" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_organization_id_name_key" ON "Tag"("organization_id", "name");

CREATE TABLE IF NOT EXISTS "LeadTag" (
  "id" TEXT PRIMARY KEY,
  "lead_id" TEXT NOT NULL,
  "tag_id" TEXT NOT NULL,
  CONSTRAINT "LeadTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeadTag_lead_id_tag_id_key" ON "LeadTag"("lead_id", "tag_id");

CREATE TABLE IF NOT EXISTS "CustomFieldDef" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "entity" TEXT NOT NULL DEFAULT 'LEAD',
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "field_type" TEXT NOT NULL,
  "options_json" TEXT NOT NULL DEFAULT '[]',
  "required_on_stage_ids" TEXT NOT NULL DEFAULT '[]'
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomFieldDef_organization_id_entity_key_key" ON "CustomFieldDef"("organization_id", "entity", "key");

CREATE TABLE IF NOT EXISTS "SalesGoal" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT,
  "group_id" TEXT,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "metric" TEXT NOT NULL,
  "target_value" DECIMAL(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS "WebhookSubscription" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "events_json" TEXT NOT NULL DEFAULT '[]',
  "secret_enc" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "fail_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "TenantApiKey" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "scopes_json" TEXT NOT NULL DEFAULT '[]',
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TenantApiKey_organization_id_key_hash_key" ON "TenantApiKey"("organization_id", "key_hash");

CREATE TABLE IF NOT EXISTS "CrmOrgSettings" (
  "organization_id" TEXT PRIMARY KEY,
  "convert_side_effects_json" TEXT NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Company" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "tax_id" TEXT,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Company_organization_id_tax_id_idx" ON "Company"("organization_id", "tax_id");

CREATE TABLE IF NOT EXISTS "Contact" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "company_id" TEXT,
  "full_name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "global_person_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contact_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Contact_organization_id_phone_idx" ON "Contact"("organization_id", "phone");
