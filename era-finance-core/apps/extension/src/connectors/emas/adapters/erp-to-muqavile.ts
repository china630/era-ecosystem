import type { EmployeeContractPrefill } from "@erafinance/api-contracts";
import {
  EMAS_FIELD_MAPPING_VERSION,
  EmasSelectors,
  looksLikeEmasSignControl,
} from "../selectors";

export class EmasFieldMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmasFieldMappingError";
  }
}

/**
 * Map ERP prefill DTO to the first matching inputs (best-effort MVP).
 * Never writes internalRate. Never clicks İmzala.
 * Missing critical fields → hard error (not silent partial wrong fill).
 */
export function mapPrefillToFields(
  prefill: EmployeeContractPrefill & {
    mappingVersion?: number;
    internalRate?: unknown;
    emasStatus?: string;
  },
  doc: Document,
): { applied: HTMLElement[]; mappingVersion: number } {
  if (prefill.internalRate != null) {
    throw new EmasFieldMappingError(
      "Prefill must not contain internalRate (MGMT rate is not for ƏMAS)",
    );
  }
  if (prefill.emasStatus && prefill.emasStatus !== "READY") {
    throw new EmasFieldMappingError(
      prefill.message ??
        `Prefill not READY (status=${prefill.emasStatus}) — refuse portal fill`,
    );
  }
  if (!prefill.finCode) {
    throw new EmasFieldMappingError(
      "Prefill missing FIN — convert-to-FIN before portal fill",
    );
  }
  const version = prefill.mappingVersion ?? EMAS_FIELD_MAPPING_VERSION;
  if (version !== EMAS_FIELD_MAPPING_VERSION) {
    throw new EmasFieldMappingError(
      `EMAS field mapping version mismatch: payload=${version} extension=${EMAS_FIELD_MAPPING_VERSION}`,
    );
  }

  const applied: HTMLElement[] = [];
  const inputs = Array.from(
    doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      EmasSelectors.formInputs,
    ),
  ).filter((el) => !looksLikeEmasSignControl(el));

  const trySet = (value: string | null | undefined, hints: RegExp[]): boolean => {
    if (value == null || value === "") return false;
    for (const el of inputs) {
      if (applied.includes(el)) continue;
      const hay =
        `${el.name} ${el.id} ${el.placeholder} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
      if (hints.some((h) => h.test(hay))) {
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        applied.push(el);
        return true;
      }
    }
    return false;
  };

  const required: Array<{ label: string; ok: boolean }> = [
    {
      label: "firstName",
      ok: trySet(prefill.firstName, [/ad/i, /name/i, /first/i]),
    },
    {
      label: "lastName",
      ok: trySet(prefill.lastName, [/soyad/i, /last/i, /surname/i]),
    },
    {
      label: "finCode",
      ok: trySet(prefill.finCode, [/fin/i, /şəxs/i]),
    },
    {
      label: "salaryGrossAzn",
      ok: trySet(prefill.salaryGrossAzn, [/maaş/i, /salary/i, /amount/i]),
    },
  ];
  trySet(prefill.positionTitle, [/vezif/i, /position/i, /title/i]);
  trySet(prefill.contractStartDate, [/başlan/i, /start/i, /from/i]);

  const missing = required.filter((r) => !r.ok).map((r) => r.label);
  if (missing.length > 0) {
    throw new EmasFieldMappingError(
      `EMAS DOM mapping failed — missing fields: ${missing.join(", ")}. Update selectors (mapping v${EMAS_FIELD_MAPPING_VERSION}).`,
    );
  }

  return { applied, mappingVersion: version };
}
