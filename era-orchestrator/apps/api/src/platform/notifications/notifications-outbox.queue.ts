export const NOTIFICATIONS_OUTBOX_QUEUE = "platform-notifications-outbox";

export type NotificationsOutboxJobPayload = {
  outboxId: string;
  organizationId: string;
};
