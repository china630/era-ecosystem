/**
 * RESOURCE_BUSY payload for nurse / matrix check-in UI (CLI-26).
 */
export type ResourceBusyDetails = {
  resourceId?: string;
  resourceName?: string | null;
  blockingOrderId?: string;
  blockingGuestName?: string | null;
  /** ISO timestamptz of factual cabin end when known. */
  blockingActualEndsAt?: string | null;
};

export function readResourceBusyDetails(payload: unknown): ResourceBusyDetails | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  let root = payload as Record<string, unknown>;
  // Nest may nest the thrown object under `message`; some BFFs under `data`.
  if (root.message && typeof root.message === "object" && !Array.isArray(root.message)) {
    root = root.message as Record<string, unknown>;
  }
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    const data = root.data as Record<string, unknown>;
    if (data.code === "RESOURCE_BUSY" || data.details || data.resourceId) {
      root = data;
    }
  }
  const raw =
    root.details && typeof root.details === "object"
      ? (root.details as Record<string, unknown>)
      : root;
  if (root.code !== "RESOURCE_BUSY" && raw.resourceId == null && raw.resourceName == null) {
    return undefined;
  }
  return {
    resourceId: typeof raw.resourceId === "string" ? raw.resourceId : undefined,
    resourceName: typeof raw.resourceName === "string" ? raw.resourceName : null,
    blockingOrderId: typeof raw.blockingOrderId === "string" ? raw.blockingOrderId : undefined,
    blockingGuestName:
      typeof raw.blockingGuestName === "string" ? raw.blockingGuestName : null,
    blockingActualEndsAt:
      typeof raw.blockingActualEndsAt === "string" ? raw.blockingActualEndsAt : null,
  };
}
