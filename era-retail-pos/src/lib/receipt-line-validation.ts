import type { RetailPreset } from "./retail-preset";
import { getRetailPresetConfig } from "./retail-preset";

export type ReceiptLineInput = {
  description: string;
  qty: number;
  unitPrice: number;
  plu?: string | null;
  barcode?: string | null;
  isWeighted?: boolean | null;
  weightKg?: number | null;
  size?: string | null;
  color?: string | null;
  serial?: string | null;
  batch?: string | null;
  rxRequired?: boolean | null;
  rxApprovedBy?: string | null;
};

function isEmpty(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === "";
}

export function computeLineTotal(line: ReceiptLineInput): number {
  if (line.isWeighted && line.weightKg != null && line.weightKg > 0) {
    return line.weightKg * line.unitPrice;
  }
  return line.qty * line.unitPrice;
}

export function validateReceiptLine(
  preset: RetailPreset,
  line: ReceiptLineInput,
  index: number,
): string | null {
  const config = getRetailPresetConfig(preset);
  const label = `Line ${index + 1}`;

  if (isEmpty(line.description)) {
    return `${label}: description is required`;
  }

  if (line.qty <= 0) {
    return `${label}: qty must be positive`;
  }

  if (line.unitPrice < 0) {
    return `${label}: unitPrice must be non-negative`;
  }

  const needsPlu = config.lineFields.includes("plu") || config.lineFields.includes("sku");
  if (needsPlu && isEmpty(line.plu)) {
    return `${label}: PLU/SKU is required for ${config.label}`;
  }

  if (config.requiresVariant) {
    if (isEmpty(line.size)) return `${label}: size is required for ${config.label}`;
    if (isEmpty(line.color)) return `${label}: color is required for ${config.label}`;
  }

  if (config.requiresSerial && isEmpty(line.serial)) {
    return `${label}: serial is required for ${config.label}`;
  }

  if (config.supportsWeighted && line.isWeighted) {
    if (line.weightKg == null || line.weightKg <= 0) {
      return `${label}: weightKg is required for weighted items`;
    }
  }

  if (config.requiresRxGate && line.rxRequired) {
    if (isEmpty(line.rxApprovedBy)) {
      return `${label}: rxApprovedBy is required for Rx items`;
    }
    if (isEmpty(line.batch)) {
      return `${label}: batch is required for Rx items`;
    }
  }

  return null;
}

export function validateReceiptLines(
  preset: RetailPreset,
  lines: ReceiptLineInput[],
): string | null {
  for (let i = 0; i < lines.length; i++) {
    const err = validateReceiptLine(preset, lines[i], i);
    if (err) return err;
  }
  return null;
}
