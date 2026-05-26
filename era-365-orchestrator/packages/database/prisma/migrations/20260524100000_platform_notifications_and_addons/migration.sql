-- Platform notifications + add-on tables (CP-B2 / CP-B3–B5)

CREATE TYPE "NotificationMessageClass" AS ENUM ('FINANCIAL', 'TRANSACTIONAL', 'LIFECYCLE', 'MARKETING');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS');
CREATE TYPE "NotificationOutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "PlatformPaymentLinkStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');
CREATE TYPE "PlatformPortalLinkStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "BookingAppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

CREATE TABLE IF NOT EXISTS "notification_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID,
    "template_key" VARCHAR(128) NOT NULL,
    "message_class" "NotificationMessageClass" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" VARCHAR(512),
    "body_template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_templates_organization_id_template_key_channel_key"
ON "notification_templates"("organization_id", "template_key", "channel");

CREATE INDEX IF NOT EXISTS "notification_templates_template_key_idx"
ON "notification_templates"("template_key");

CREATE TABLE IF NOT EXISTS "notification_outbox" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "template_key" VARCHAR(128) NOT NULL,
    "template_id" UUID,
    "message_class" "NotificationMessageClass" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" VARCHAR(256) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "source_entity_type" VARCHAR(64) NOT NULL,
    "source_entity_id" VARCHAR(128) NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_outbox_organization_id_source_entity_type_source_entity_id_template_key_key"
ON "notification_outbox"("organization_id", "source_entity_type", "source_entity_id", "template_key");

CREATE INDEX IF NOT EXISTS "notification_outbox_organization_id_status_created_at_idx"
ON "notification_outbox"("organization_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "notification_delivery_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "outbox_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationOutboxStatus" NOT NULL,
    "provider_payload" JSONB,
    "error_message" TEXT,
    "attempted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notification_delivery_logs_outbox_id_attempted_at_idx"
ON "notification_delivery_logs"("outbox_id", "attempted_at");

CREATE INDEX IF NOT EXISTS "notification_delivery_logs_organization_id_attempted_at_idx"
ON "notification_delivery_logs"("organization_id", "attempted_at");

CREATE TABLE IF NOT EXISTS "platform_payment_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "amount_azn" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'AZN',
    "counterparty_ref" VARCHAR(128),
    "source_entity_type" VARCHAR(64) NOT NULL,
    "source_entity_id" VARCHAR(128) NOT NULL,
    "payment_order_id" UUID,
    "token" VARCHAR(64) NOT NULL,
    "payment_url" TEXT,
    "status" "PlatformPaymentLinkStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "platform_payment_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_payment_links_token_key" ON "platform_payment_links"("token");
CREATE INDEX IF NOT EXISTS "platform_payment_links_organization_id_status_idx"
ON "platform_payment_links"("organization_id", "status");

CREATE TABLE IF NOT EXISTS "platform_portal_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" VARCHAR(128) NOT NULL,
    "status" "PlatformPortalLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_portal_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_portal_links_token_key" ON "platform_portal_links"("token");
CREATE INDEX IF NOT EXISTS "platform_portal_links_organization_id_entity_type_entity_id_idx"
ON "platform_portal_links"("organization_id", "entity_type", "entity_id");

CREATE TABLE IF NOT EXISTS "bookable_resources" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "resource_key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bookable_resources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bookable_resources_organization_id_resource_key_key"
ON "bookable_resources"("organization_id", "resource_key");

CREATE TABLE IF NOT EXISTS "booking_slots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "booked_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_slots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "booking_slots_organization_id_starts_at_idx"
ON "booking_slots"("organization_id", "starts_at");

CREATE TABLE IF NOT EXISTS "booking_appointments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "resource_id" UUID,
    "slot_id" UUID,
    "customer_ref" VARCHAR(128) NOT NULL,
    "customer_phone" VARCHAR(32),
    "customer_name" VARCHAR(256),
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "BookingAppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_appointments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "booking_appointments_organization_id_scheduled_at_idx"
ON "booking_appointments"("organization_id", "scheduled_at");

ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_outbox_id_fkey"
FOREIGN KEY ("outbox_id") REFERENCES "notification_outbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_payment_links" ADD CONSTRAINT "platform_payment_links_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_payment_links" ADD CONSTRAINT "platform_payment_links_payment_order_id_fkey"
FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform_portal_links" ADD CONSTRAINT "platform_portal_links_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bookable_resources" ADD CONSTRAINT "bookable_resources_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_resource_id_fkey"
FOREIGN KEY ("resource_id") REFERENCES "bookable_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_appointments" ADD CONSTRAINT "booking_appointments_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_appointments" ADD CONSTRAINT "booking_appointments_resource_id_fkey"
FOREIGN KEY ("resource_id") REFERENCES "bookable_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking_appointments" ADD CONSTRAINT "booking_appointments_slot_id_fkey"
FOREIGN KEY ("slot_id") REFERENCES "booking_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "notification_templates" ("template_key", "message_class", "channel", "subject", "body_template", "updated_at")
VALUES
  ('finance.invoice.email', 'FINANCIAL', 'EMAIL', 'Invoice issued', 'Your invoice {{invoiceNumber}} is ready.', NOW()),
  ('finance.invoice.whatsapp', 'FINANCIAL', 'WHATSAPP', NULL, 'Invoice {{invoiceNumber}} — pay: {{paymentLink}}', NOW()),
  ('clinic.appointment.reminder', 'TRANSACTIONAL', 'WHATSAPP', NULL, 'Reminder: appointment on {{scheduledAt}} with {{practitionerName}}.', NOW()),
  ('auto.service.due', 'LIFECYCLE', 'WHATSAPP', NULL, 'Service due for {{vehiclePlate}}. Book: {{bookingLink}}', NOW())
ON CONFLICT DO NOTHING;
