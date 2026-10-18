export const BATH_TRANSFER_PREFIX = "XFER-";

export function foldHay(s: string): string {
  return s
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");
}

export function isBathTransferQuota(code: string): boolean {
  return code.trim().toUpperCase().startsWith(BATH_TRANSFER_PREFIX);
}

export function bathTransferSku(code: string): string {
  return isBathTransferQuota(code) ? code.trim().slice(BATH_TRANSFER_PREFIX.length) : code;
}

export function bathTransferQuotaCode(sku: string): string {
  return `${BATH_TRANSFER_PREFIX}${sku.trim()}`;
}

/** Unused bath / naftalan / application quota that can move to another package SKU. */
export function isBathQuotaLine(code: string, name?: string | null): boolean {
  if (isBathTransferQuota(code)) return false;
  const hay = foldHay(`${code} ${name ?? ""}`);
  return /vann|bath|naftalan|aplikasiya|iod|yod.?brom|4.?kam|four.?chamber/.test(hay);
}
