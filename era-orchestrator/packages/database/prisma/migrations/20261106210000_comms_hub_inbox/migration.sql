-- CP-COMMS-01: org messaging inbox + IN_APP notification channel for bell delivery.

ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'IN_APP';

CREATE TABLE "comms_threads" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "subject" VARCHAR(256) NOT NULL,
    "author_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "comms_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comms_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "thread_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comms_participants" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "thread_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_participants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comms_threads_organization_id_updated_at_idx" ON "comms_threads"("organization_id", "updated_at");
CREATE INDEX "comms_threads_author_user_id_idx" ON "comms_threads"("author_user_id");
CREATE INDEX "comms_messages_thread_id_created_at_idx" ON "comms_messages"("thread_id", "created_at");
CREATE INDEX "comms_messages_author_user_id_idx" ON "comms_messages"("author_user_id");
CREATE UNIQUE INDEX "comms_participants_thread_id_user_id_key" ON "comms_participants"("thread_id", "user_id");
CREATE INDEX "comms_participants_user_id_read_at_idx" ON "comms_participants"("user_id", "read_at");

ALTER TABLE "comms_threads" ADD CONSTRAINT "comms_threads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comms_threads" ADD CONSTRAINT "comms_threads_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comms_messages" ADD CONSTRAINT "comms_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "comms_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comms_messages" ADD CONSTRAINT "comms_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comms_participants" ADD CONSTRAINT "comms_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "comms_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comms_participants" ADD CONSTRAINT "comms_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
