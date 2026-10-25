import { BadRequestException, Injectable } from "@nestjs/common";
import { getRuntimeConfigMemory } from "@era/satellite-kit";
import { tenantContextStorage } from "../prisma/tenant-context";
import { SystemConfigService } from "../system-config/system-config.service";

export type ManualFxRow = {
  currencyCode: string;
  rate: number;
  rateDate: string;
};

export type ManualBankRow = {
  code: string;
  nameAz: string;
  voen: string;
};

export type ManualCalendarRow = {
  date: string;
  isWorking: boolean;
  label?: string;
};

export type ManualHsRow = {
  hsCode: string;
  dutyRatePercent: number;
  vatRatePercent: number;
  excisePercent: number;
};

type ManualBundle = {
  fx: ManualFxRow[];
  banks: ManualBankRow[];
  calendar: ManualCalendarRow[];
  hs: ManualHsRow[];
};

const EMPTY: ManualBundle = { fx: [], banks: [], calendar: [], hs: [] };

function orgKey(organizationId: string): string {
  return `reference.manual.${organizationId}`;
}

function activeOrganizationId(): string | null {
  const fromRequest = tenantContextStorage.getStore()?.organizationId?.trim();
  if (fromRequest) return fromRequest;
  return getRuntimeConfigMemory().organizationId?.trim() || null;
}

@Injectable()
export class ReferenceManualService {
  constructor(private readonly config: SystemConfigService) {}

  /** Excel mode applies to the org bound on this install. */
  usesExcel(organizationId?: string | null): boolean {
    const cfg = getRuntimeConfigMemory();
    if (cfg.referenceSource !== "excel") return false;
    const org = organizationId?.trim() || activeOrganizationId();
    if (cfg.organizationId && org && cfg.organizationId !== org) return false;
    return true;
  }

  async bundle(organizationId?: string | null): Promise<ManualBundle> {
    const org = organizationId?.trim() || activeOrganizationId();
    if (!org) return { ...EMPTY };
    const raw = await this.config.getJson(orgKey(org));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY };
    const body = raw as Partial<ManualBundle>;
    return {
      fx: Array.isArray(body.fx) ? body.fx : [],
      banks: Array.isArray(body.banks) ? body.banks : [],
      calendar: Array.isArray(body.calendar) ? body.calendar : [],
      hs: Array.isArray(body.hs) ? body.hs : [],
    };
  }

  async replace(
    organizationId: string,
    catalog: keyof ManualBundle,
    rows: ManualBundle[keyof ManualBundle],
  ): Promise<{ count: number }> {
    const current = await this.bundle(organizationId);
    const next: ManualBundle = { ...current, [catalog]: rows };
    await this.config.setJson(orgKey(organizationId), next);
    return { count: rows.length };
  }

  parseFxSheet(rows: Array<Record<string, unknown>>): ManualFxRow[] {
    const out: ManualFxRow[] = [];
    for (const row of rows) {
      const currencyCode = String(row.currencyCode ?? row.currency ?? "")
        .trim()
        .toUpperCase();
      const rate = Number(row.rate);
      const rateDate = String(row.rateDate ?? row.date ?? "").trim().slice(0, 10);
      if (!/^[A-Z]{3}$/.test(currencyCode) || !Number.isFinite(rate) || !/^\d{4}-\d{2}-\d{2}$/.test(rateDate)) {
        continue;
      }
      out.push({ currencyCode, rate, rateDate });
    }
    if (!out.length) {
      throw new BadRequestException("No FX rows. Expected currencyCode, rate, rateDate (YYYY-MM-DD).");
    }
    return out;
  }
}
