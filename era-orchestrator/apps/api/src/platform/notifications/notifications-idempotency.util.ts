export function buildNotificationIdempotencyKey(input: {
  organizationId: string;
  sourceEntityType: string;
  sourceEntityId: string;
  templateKey: string;
}): string {
  return [
    input.organizationId,
    input.sourceEntityType,
    input.sourceEntityId,
    input.templateKey,
  ].join(":");
}
