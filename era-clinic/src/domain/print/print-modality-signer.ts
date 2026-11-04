import { getDefaultTenant } from "@/domain/settings/settings.service";
import { performerNameForUserIds } from "@/domain/print/print-performer";

export function parseModalitySigners(raw: string | null | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [code, name] of Object.entries(parsed)) {
      if (typeof name !== "string") continue;
      const trimmed = name.trim();
      if (trimmed) out[code] = trimmed;
    }
    return out;
  } catch {
    return {};
  }
}

/** Configured family name wins. The person who entered the result is the fallback. */
export function blankSigner(configured: string | null | undefined, performer: string | null): string | null {
  const name = configured?.trim();
  if (name) return name;
  return performer?.trim() || null;
}

export async function signerForModality(
  modalityCode: string | null | undefined,
  enteredByUserIds: Array<string | null | undefined>,
): Promise<string | null> {
  const tenant = await getDefaultTenant();
  const map = parseModalitySigners(tenant.printModalitySignersJson);
  const configured = modalityCode ? map[modalityCode] : null;
  const performer = await performerNameForUserIds(enteredByUserIds);
  return blankSigner(configured, performer);
}
