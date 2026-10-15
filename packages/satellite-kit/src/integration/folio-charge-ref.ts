/**
 * One folio-line key for every satellite and the hotel.
 * The hotel stores the string it receives. Later reads use the same functions.
 * Existing stored values keep their current spelling.
 */

export function clinicProcedureTicketRef(orderId: string): string {
  const id = orderId.trim();
  if (!id) throw new Error("orderId required");
  return `clinic-ticket-${id}`;
}

export function fnbTicketLineRef(ticketId: string, lineId: string): string {
  const ticket = ticketId.trim();
  const line = lineId.trim();
  if (!ticket || !line) throw new Error("ticket line required");
  return `${ticket}:${line}`;
}

/** Room-charge sale. Matches rows already stored as `receiptId:lineId`. */
export function retailReceiptLineRef(receiptId: string, lineId: string): string {
  const receipt = receiptId.trim();
  const line = lineId.trim();
  if (!receipt || !line) throw new Error("receipt line required");
  return `${receipt}:${line}`;
}

/** Walk-in hub pending. Matches rows already stored as `retail-{receipt}-{line}`. */
export function retailPendingLineRef(receiptId: string, lineId: string): string {
  const receipt = receiptId.trim();
  const line = lineId.trim();
  if (!receipt || !line) throw new Error("receipt line required");
  return `retail-${receipt}-${line}`;
}

export function retailReturnLineRef(returnReceiptId: string, lineId: string): string {
  const receipt = returnReceiptId.trim();
  const line = lineId.trim();
  if (!receipt || !line) throw new Error("return line required");
  return `retail-return-${receipt}-${line}`;
}

/** Room-charge return. Matches rows already stored as `return:{receipt}:{line}`. */
export function retailRoomReturnRef(returnReceiptId: string, lineId: string): string {
  const receipt = returnReceiptId.trim();
  const line = lineId.trim();
  if (!receipt || !line) throw new Error("return line required");
  return `return:${receipt}:${line}`;
}

export function retailPrescriptionRef(saleId: string, sku: string, returned = false): string {
  const id = saleId.trim();
  const code = sku.trim();
  if (!id || !code) throw new Error("prescription line required");
  return `${returned ? "rx-return" : "rx"}:${id}:${code}`;
}

export type FolioChargeSource =
  | { source: "clinic"; orderId: string; ref: string }
  | { source: "fnb"; ref: string }
  | { source: "retail"; ref: string }
  | { source: "retail-return"; ref: string }
  | { source: "retail-prescription"; ref: string; returned: boolean };

/**
 * Recognize a stored folio key. A mistaken `pay-` prefix is stripped on read
 * so an old row still matches; writers must not add it.
 */
export function parseFolioChargeRef(ref: string | null | undefined): FolioChargeSource | null {
  let value = ref?.trim() ?? "";
  if (!value) return null;
  if (value.startsWith("pay-")) value = value.slice("pay-".length);
  if (value.startsWith("clinic-ticket-")) {
    const orderId = value.slice("clinic-ticket-".length);
    if (!orderId) return null;
    return { source: "clinic", orderId, ref: clinicProcedureTicketRef(orderId) };
  }
  if (value.startsWith("retail-return-")) return { source: "retail-return", ref: value };
  if (value.startsWith("retail-")) return { source: "retail", ref: value };
  if (value.startsWith("rx-return:")) {
    return { source: "retail-prescription", ref: value, returned: true };
  }
  if (value.startsWith("rx:")) {
    return { source: "retail-prescription", ref: value, returned: false };
  }
  if (value.startsWith("return:")) return { source: "retail-return", ref: value };
  if (value.includes(":")) return { source: "fnb", ref: value };
  return null;
}
