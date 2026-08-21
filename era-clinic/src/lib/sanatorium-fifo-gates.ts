/** Pure sanatorium doctor-confirm FIFO gates (AC-CLI-SAN). */

export type ProposedOrderRef = {
  id: string;
  sequenceIndex: number | null;
};

/**
 * Refuse confirm when the batch skips an earlier PROPOSED order for the same patient
 * (lower sequenceIndex). Callers map this to HTTP 409.
 */
export function fifoConfirmBlockedReason(input: {
  confirmingIds: string[];
  proposedForPatient: ProposedOrderRef[];
}): string | null {
  if (input.confirmingIds.length === 0) return "orderIds required";
  const confirming = new Set(input.confirmingIds);
  const sorted = [...input.proposedForPatient].sort(
    (a, b) => (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0),
  );
  if (sorted.length === 0) return null;

  const selectedIndexes = input.confirmingIds.map((id) => {
    const row = sorted.find((p) => p.id === id);
    return row?.sequenceIndex ?? Number.POSITIVE_INFINITY;
  });
  const minSelected = Math.min(...selectedIndexes);
  if (!Number.isFinite(minSelected)) return "Unknown PROPOSED order in confirm batch";

  for (const order of sorted) {
    const seq = order.sequenceIndex ?? 0;
    if (seq < minSelected && !confirming.has(order.id)) {
      return "FIFO: confirm earliest PROPOSED order first";
    }
  }
  return null;
}

export function procedureConfirmHttpStatus(reason: string | null): number {
  if (!reason) return 200;
  if (reason.startsWith("FIFO:")) return 409;
  return 400;
}
