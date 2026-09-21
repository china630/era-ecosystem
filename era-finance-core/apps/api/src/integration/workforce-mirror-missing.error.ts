/**
 * Thrown when a CP workforce event arrives before its Finance mirror dependency.
 * Satellite event worker must NOT mark the job idempotent — BullMQ retries until
 * org-structure / positions are mirrored (Evrostar wave 0 import order).
 */
export class WorkforceMirrorMissingError extends Error {
  readonly reason: string;

  constructor(reason: string, detail: string) {
    super(`Workforce mirror missing (${reason}): ${detail}`);
    this.name = "WorkforceMirrorMissingError";
    this.reason = reason;
  }
}
