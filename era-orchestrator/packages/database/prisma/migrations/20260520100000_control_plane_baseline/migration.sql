-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "TariffTier" AS ENUM ('TIER_0', 'TIER_1', 'TIER_2', 'TIER_3');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'SOFT_BLOCK', 'HARD_BLOCK');

-- CreateEnum
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PricingKind" AS ENUM ('FOUNDATION', 'MODULE', 'QUOTA');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReferralCommissionStatus" AS ENUM ('ACCRUED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'USER', 'PROCUREMENT', 'AUDITOR', 'WAREHOUSE_KEEPER', 'HR_OFFICER', 'HR_MANAGER', 'DEPARTMENT_HEAD', 'DIRECTOR', 'PARTNER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('EVIDENCE_REQUIRED', 'EVIDENCE_REVIEW', 'INCUMBENT_NOTIFIED', 'COOLDOWN', 'APPROVED', 'REJECTED', 'EXECUTED', 'REVERTED');

-- CreateEnum
CREATE TYPE "DisputeSeverity" AS ENUM ('SOFT', 'HARD');

-- CreateEnum
CREATE TYPE "SecurityMode" AS ENUM ('NORMAL', 'DISPUTE', 'POST_TRANSFER_LOCK', 'ROLLBACK_IN_PROGRESS', 'HARD_BLOCK_PLATFORM');

-- CreateEnum
CREATE TYPE "NotificationMessageClass" AS ENUM ('FINANCIAL', 'TRANSACTIONAL', 'LIFECYCLE', 'MARKETING');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationOutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlatformPaymentLinkStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlatformPortalLinkStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BookingAppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PlatformPromotionDiscountType" AS ENUM ('PERCENT', 'FIXED_AZN');

-- CreateEnum
CREATE TYPE "PlatformPromotionStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "PlatformCustomDomainStatus" AS ENUM ('PENDING_DNS', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "PlatformShipmentStatus" AS ENUM ('CREATED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PermissionCategory" AS ENUM ('CORE', 'BILLING', 'ACCOUNTING', 'SALES', 'PURCHASES', 'INVENTORY', 'HR', 'PSA', 'CUSTOMS', 'ADMIN', 'REPORTING', 'INTEGRATIONS');

-- CreateEnum
CREATE TYPE "EarlyAccessModuleKey" AS ENUM ('RETAIL_ECOM', 'LOGISTICS_CUSTOMS', 'CONSTRUCTION', 'CRM_WHATSAPP', 'AUTO_STO', 'CLINIC', 'WHOLESALE', 'HOTEL_PMS', 'FB_POS');

-- CreateEnum
CREATE TYPE "EarlyAccessEventType" AS ENUM ('VIEW_CLICK', 'MODAL_OPEN', 'MODAL_CLOSE', 'CTA_CLICK', 'SURVEY_SUBMIT');

-- CreateTable
CREATE TABLE "tenant_billing" (
    "organization_id" UUID NOT NULL,
    "billing_status" "BillingStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscription_plan" TEXT,
    "active_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "billing_period_key" VARCHAR(7),
    "whatsapp_alerts_used" INTEGER NOT NULL DEFAULT 0,
    "ocr_pages_used" INTEGER NOT NULL DEFAULT 0,
    "accumulated_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "current_credit_tier" "TariffTier",
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_billing_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "organization_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "current_tier" "TariffTier" NOT NULL DEFAULT 'TIER_0',
    "is_trial" BOOLEAN NOT NULL DEFAULT true,
    "trial_expires_at" TIMESTAMPTZ(6),
    "activated_premium_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "billing_period_key" VARCHAR(7),
    "expires_at" TIMESTAMPTZ(6),
    "active_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "custom_config" JSONB,

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "SubscriptionInvoiceStatus" NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "period_start" TIMESTAMPTZ(6),
    "period_end" TIMESTAMPTZ(6),
    "billing_period" TEXT,
    "pdf_link" TEXT,
    "payment_order_id" UUID,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoice_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "subscription_invoice_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "billing_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_meter_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "action_type" VARCHAR(64) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_cost_azn" DECIMAL(12,4) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_meter_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_modules" (
    "organization_id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,
    "price_snapshot" DECIMAL(12,2) NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pending_deactivation" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "access_until" TIMESTAMPTZ(6),

    CONSTRAINT "organization_modules_pkey" PRIMARY KEY ("organization_id","module_key")
);

-- CreateTable
CREATE TABLE "organization_bundles" (
    "organization_id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "price_snapshot" DECIMAL(12,2) NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pending_deactivation" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "access_until" TIMESTAMPTZ(6),

    CONSTRAINT "organization_bundles_pkey" PRIMARY KEY ("organization_id","bundle_id")
);

-- CreateTable
CREATE TABLE "pricing" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" TEXT NOT NULL,
    "kind" "PricingKind" NOT NULL,
    "name" TEXT NOT NULL,
    "amount_azn" DECIMAL(12,2) NOT NULL,
    "unit_size" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_modules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_per_month" DECIMAL(12,2) NOT NULL,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_bundles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "module_keys" JSONB NOT NULL,
    "is_trial_default" BOOLEAN NOT NULL DEFAULT false,
    "trial_duration_days" INTEGER,
    "trial_quotas" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_module_marketing" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "module_slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "names" JSONB NOT NULL,
    "descriptions" JSONB NOT NULL,
    "tasks" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_module_marketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "amount_azn" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'pasha_bank',
    "provider_txn_id" TEXT,
    "months_applied" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL DEFAULT '',
    "idempotency_key" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "legacy_enum_role" "UserRole",
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "name_az" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "category" "PermissionCategory" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "owner_id" UUID,
    "tax_id_blind_index" TEXT,
    "tax_id_cipher" TEXT,
    "subscription_plan" TEXT,
    "billing_status" "BillingStatus" NOT NULL DEFAULT 'ACTIVE',
    "active_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "storage_used_bytes" BIGINT NOT NULL DEFAULT 0,
    "current_credit_tier" "TariffTier",
    "accumulated_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "billing_period_key" VARCHAR(7),
    "whatsapp_alerts_used" INTEGER NOT NULL DEFAULT 0,
    "ocr_pages_used" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "drakaris_client_id" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "first_name_cipher" TEXT,
    "last_name_cipher" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_user_id" UUID,
    "deleted_reason" TEXT,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("user_id","organization_id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "decided_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_user_id" UUID,
    "deleted_reason" TEXT,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invites" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_user_id" UUID,
    "deleted_reason" TEXT,

    CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "owner_user_id" UUID,
    "is_corporate" BOOLEAN NOT NULL DEFAULT false,
    "fixed_rate_percent" DECIMAL(5,2),
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "partner_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "signup_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "window_ends_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_commissions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "referral_id" UUID NOT NULL,
    "subscription_invoice_id" UUID,
    "amount_azn" DECIMAL(19,4) NOT NULL,
    "rate_percent" DECIMAL(5,2) NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "status" "ReferralCommissionStatus" NOT NULL DEFAULT 'ACCRUED',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_disputes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "claimant_user_id" UUID NOT NULL,
    "incumbent_user_id" UUID NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'EVIDENCE_REQUIRED',
    "severity" "DisputeSeverity" NOT NULL DEFAULT 'SOFT',
    "evidence_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "counter_claim_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_at" TIMESTAMPTZ(6),

    CONSTRAINT "ownership_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_security_states" (
    "organization_id" UUID NOT NULL,
    "mode" "SecurityMode" NOT NULL DEFAULT 'NORMAL',
    "lock_until" TIMESTAMPTZ(6),
    "active_dispute_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_security_states_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "early_access_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "module_key" "EarlyAccessModuleKey" NOT NULL,
    "event_type" "EarlyAccessEventType" NOT NULL,
    "user_id" UUID,
    "organization_id" UUID,
    "subscription_tier" VARCHAR(32),
    "industry_snapshot" VARCHAR(64),
    "session_id" UUID NOT NULL,
    "duration_ms" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_ip" VARCHAR(64),
    "user_agent" VARCHAR(512),

    CONSTRAINT "early_access_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "early_access_signups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "module_key" "EarlyAccessModuleKey" NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_tier" VARCHAR(32),
    "industry" VARCHAR(64),
    "survey_answer" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "early_access_signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "early_access_threshold_alerts" (
    "module_key" "EarlyAccessModuleKey" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "fired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fired_to_count" INTEGER NOT NULL,

    CONSTRAINT "early_access_threshold_alerts_pkey" PRIMARY KEY ("module_key","threshold")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID,
    "user_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "old_values" JSONB,
    "new_values" JSONB,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "hash" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
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

-- CreateTable
CREATE TABLE "notification_outbox" (
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

-- CreateTable
CREATE TABLE "notification_delivery_logs" (
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

-- CreateTable
CREATE TABLE "platform_payment_links" (
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

-- CreateTable
CREATE TABLE "platform_portal_links" (
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

-- CreateTable
CREATE TABLE "bookable_resources" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "resource_key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookable_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_slots" (
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

-- CreateTable
CREATE TABLE "booking_appointments" (
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

-- CreateTable
CREATE TABLE "platform_promotions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "discount_type" "PlatformPromotionDiscountType" NOT NULL,
    "discount_value" DECIMAL(12,2) NOT NULL,
    "valid_from" TIMESTAMPTZ(6),
    "valid_until" TIMESTAMPTZ(6),
    "status" "PlatformPromotionStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_custom_domains" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "hostname" VARCHAR(253) NOT NULL,
    "status" "PlatformCustomDomainStatus" NOT NULL DEFAULT 'PENDING_DNS',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_custom_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_shipments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "external_ref" VARCHAR(128),
    "tracking_token" VARCHAR(64) NOT NULL,
    "status" "PlatformShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "source_entity_type" VARCHAR(64) NOT NULL,
    "source_entity_id" VARCHAR(128) NOT NULL,
    "recipient_phone" VARCHAR(32),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "addon_slug" VARCHAR(64) NOT NULL,
    "action" VARCHAR(128) NOT NULL,
    "idempotency_key" VARCHAR(128),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_idempotency_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "scope" VARCHAR(128) NOT NULL,
    "idempotency_key" VARCHAR(256) NOT NULL,
    "response_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_loyalty_ledger" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "customer_ref" VARCHAR(128) NOT NULL,
    "points_delta" INTEGER NOT NULL,
    "reason" VARCHAR(128) NOT NULL,
    "promotion_code" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_loyalty_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_subscriptions_organization_id_key" ON "organization_subscriptions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_payment_order_id_key" ON "subscription_invoices"("payment_order_id");

-- CreateIndex
CREATE INDEX "subscription_invoices_user_id_idx" ON "subscription_invoices"("user_id");

-- CreateIndex
CREATE INDEX "subscription_invoices_user_id_date_idx" ON "subscription_invoices"("user_id", "date");

-- CreateIndex
CREATE INDEX "subscription_invoices_user_id_billing_period_idx" ON "subscription_invoices"("user_id", "billing_period");

-- CreateIndex
CREATE INDEX "billing_invoice_items_subscription_invoice_id_idx" ON "billing_invoice_items"("subscription_invoice_id");

-- CreateIndex
CREATE INDEX "billing_invoice_items_organization_id_idx" ON "billing_invoice_items"("organization_id");

-- CreateIndex
CREATE INDEX "usage_meter_events_organization_id_created_at_idx" ON "usage_meter_events"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_key_key" ON "pricing"("key");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_modules_key_key" ON "pricing_modules"("key");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_bundles_slug_key" ON "pricing_bundles"("slug");

-- CreateIndex
CREATE INDEX "pricing_bundles_is_trial_default_idx" ON "pricing_bundles"("is_trial_default");

-- CreateIndex
CREATE UNIQUE INDEX "landing_module_marketing_module_slug_key" ON "landing_module_marketing"("module_slug");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_idempotency_key_key" ON "payment_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_orders_organization_id_idx" ON "payment_orders"("organization_id");

-- CreateIndex
CREATE INDEX "payment_orders_status_idx" ON "payment_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_tax_id_blind_index_key" ON "organizations"("tax_id_blind_index");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_drakaris_client_id_key" ON "organizations"("drakaris_client_id");

-- CreateIndex
CREATE INDEX "organizations_owner_id_idx" ON "organizations"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_idx" ON "organization_memberships"("organization_id");

-- CreateIndex
CREATE INDEX "organization_memberships_org_deleted_at_idx" ON "organization_memberships"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "access_requests_organization_id_status_idx" ON "access_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "access_requests_requester_id_idx" ON "access_requests"("requester_id");

-- CreateIndex
CREATE INDEX "access_requests_org_deleted_at_idx" ON "access_requests"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "organization_invites_organization_id_email_idx" ON "organization_invites"("organization_id", "email");

-- CreateIndex
CREATE INDEX "organization_invites_org_deleted_at_idx" ON "organization_invites"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "partners_code_key" ON "partners"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_organization_id_key" ON "referrals"("organization_id");

-- CreateIndex
CREATE INDEX "referrals_partner_id_idx" ON "referrals"("partner_id");

-- CreateIndex
CREATE INDEX "referrals_window_ends_at_idx" ON "referrals"("window_ends_at");

-- CreateIndex
CREATE INDEX "referral_commissions_subscription_invoice_id_idx" ON "referral_commissions"("subscription_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_commissions_referral_id_period_year_period_month_key" ON "referral_commissions"("referral_id", "period_year", "period_month");

-- CreateIndex
CREATE INDEX "ownership_disputes_organization_id_status_idx" ON "ownership_disputes"("organization_id", "status");

-- CreateIndex
CREATE INDEX "early_access_events_module_key_created_at_idx" ON "early_access_events"("module_key", "created_at");

-- CreateIndex
CREATE INDEX "early_access_events_organization_id_module_key_idx" ON "early_access_events"("organization_id", "module_key");

-- CreateIndex
CREATE INDEX "early_access_events_session_id_idx" ON "early_access_events"("session_id");

-- CreateIndex
CREATE INDEX "early_access_signups_organization_id_idx" ON "early_access_signups"("organization_id");

-- CreateIndex
CREATE INDEX "early_access_signups_module_key_created_at_idx" ON "early_access_signups"("module_key", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "early_access_signups_module_key_organization_id_key" ON "early_access_signups"("module_key", "organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notification_templates_template_key_idx" ON "notification_templates"("template_key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_organization_id_template_key_channel_key" ON "notification_templates"("organization_id", "template_key", "channel");

-- CreateIndex
CREATE INDEX "notification_outbox_organization_id_status_created_at_idx" ON "notification_outbox"("organization_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_organization_id_source_entity_type_sour_key" ON "notification_outbox"("organization_id", "source_entity_type", "source_entity_id", "template_key");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_outbox_id_attempted_at_idx" ON "notification_delivery_logs"("outbox_id", "attempted_at");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_organization_id_attempted_at_idx" ON "notification_delivery_logs"("organization_id", "attempted_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_payment_links_token_key" ON "platform_payment_links"("token");

-- CreateIndex
CREATE INDEX "platform_payment_links_organization_id_status_idx" ON "platform_payment_links"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "platform_portal_links_token_key" ON "platform_portal_links"("token");

-- CreateIndex
CREATE INDEX "platform_portal_links_organization_id_entity_type_entity_id_idx" ON "platform_portal_links"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookable_resources_organization_id_resource_key_key" ON "bookable_resources"("organization_id", "resource_key");

-- CreateIndex
CREATE INDEX "booking_slots_organization_id_starts_at_idx" ON "booking_slots"("organization_id", "starts_at");

-- CreateIndex
CREATE INDEX "booking_appointments_organization_id_scheduled_at_idx" ON "booking_appointments"("organization_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "platform_promotions_organization_id_status_idx" ON "platform_promotions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "platform_promotions_organization_id_code_key" ON "platform_promotions"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "platform_custom_domains_organization_id_hostname_key" ON "platform_custom_domains"("organization_id", "hostname");

-- CreateIndex
CREATE UNIQUE INDEX "platform_shipments_tracking_token_key" ON "platform_shipments"("tracking_token");

-- CreateIndex
CREATE INDEX "platform_shipments_organization_id_status_idx" ON "platform_shipments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "platform_shipments_organization_id_source_entity_type_sourc_idx" ON "platform_shipments"("organization_id", "source_entity_type", "source_entity_id");

-- CreateIndex
CREATE INDEX "platform_audit_logs_organization_id_created_at_idx" ON "platform_audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_idempotency_records_organization_id_scope_idempote_key" ON "platform_idempotency_records"("organization_id", "scope", "idempotency_key");

-- CreateIndex
CREATE INDEX "platform_loyalty_ledger_organization_id_customer_ref_idx" ON "platform_loyalty_ledger"("organization_id", "customer_ref");

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_items" ADD CONSTRAINT "billing_invoice_items_subscription_invoice_id_fkey" FOREIGN KEY ("subscription_invoice_id") REFERENCES "subscription_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_items" ADD CONSTRAINT "billing_invoice_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_meter_events" ADD CONSTRAINT "usage_meter_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_bundles" ADD CONSTRAINT "organization_bundles_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "pricing_bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_commissions" ADD CONSTRAINT "referral_commissions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_commissions" ADD CONSTRAINT "referral_commissions_subscription_invoice_id_fkey" FOREIGN KEY ("subscription_invoice_id") REFERENCES "subscription_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_access_events" ADD CONSTRAINT "early_access_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_access_events" ADD CONSTRAINT "early_access_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_access_signups" ADD CONSTRAINT "early_access_signups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_access_signups" ADD CONSTRAINT "early_access_signups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_outbox_id_fkey" FOREIGN KEY ("outbox_id") REFERENCES "notification_outbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_payment_links" ADD CONSTRAINT "platform_payment_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_payment_links" ADD CONSTRAINT "platform_payment_links_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_portal_links" ADD CONSTRAINT "platform_portal_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookable_resources" ADD CONSTRAINT "bookable_resources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "bookable_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_appointments" ADD CONSTRAINT "booking_appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_appointments" ADD CONSTRAINT "booking_appointments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "bookable_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_appointments" ADD CONSTRAINT "booking_appointments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "booking_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_promotions" ADD CONSTRAINT "platform_promotions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_custom_domains" ADD CONSTRAINT "platform_custom_domains_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_shipments" ADD CONSTRAINT "platform_shipments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_idempotency_records" ADD CONSTRAINT "platform_idempotency_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_loyalty_ledger" ADD CONSTRAINT "platform_loyalty_ledger_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
