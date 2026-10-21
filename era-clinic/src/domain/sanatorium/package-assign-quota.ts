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
  const parsed = parseTransferQuota(code);
  return parsed ? parsed.sku : code;
}

/** Legacy `XFER-{sku}` or `XFER-{from}--{sku}` so the predecessor block stays on the line. */
export function transferQuotaCode(fromCode: string, sku: string): string {
  return `${BATH_TRANSFER_PREFIX}${fromCode.trim()}--${sku.trim()}`;
}

export function bathTransferQuotaCode(sku: string): string {
  return `${BATH_TRANSFER_PREFIX}${sku.trim()}`;
}

export function parseTransferQuota(
  code: string,
): { fromCode: string; sku: string } | null {
  if (!isBathTransferQuota(code)) return null;
  const rest = code.trim().slice(BATH_TRANSFER_PREFIX.length);
  const sep = rest.indexOf("--");
  if (sep < 0) return { fromCode: "", sku: rest };
  return { fromCode: rest.slice(0, sep), sku: rest.slice(sep + 2) };
}

/** Block whose daily cap this quota line spends. Predecessor wins for a transfer. */
export function capBlockOfQuota(
  quotaCode: string,
  predecessorByQuota?: ReadonlyMap<string, string>,
): string {
  const parsed = parseTransferQuota(quotaCode);
  if (parsed?.fromCode) return parsed.fromCode;
  if (parsed) return predecessorByQuota?.get(quotaCode) || quotaCode;
  return quotaCode;
}

export function isParaffinQuotaLine(code: string, name?: string | null): boolean {
  if (isBathTransferQuota(code)) return false;
  return /parafin|paraffin/.test(foldHay(`${code} ${name ?? ""}`));
}

export function isReplaceableQuotaLine(code: string, name?: string | null): boolean {
  return isBathQuotaLine(code, name) || isParaffinQuotaLine(code, name);
}

/** Unused bath / naftalan / application quota that can move to another package SKU. */
export function isBathQuotaLine(code: string, name?: string | null): boolean {
  if (isBathTransferQuota(code)) return false;
  const hay = foldHay(`${code} ${name ?? ""}`);
  return /vann|bath|naftalan|aplikasiya|iod|yod.?brom|4.?kam|four.?chamber/.test(hay);
}
