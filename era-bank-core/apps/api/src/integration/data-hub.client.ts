import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

type SnapshotFxRow = { code: string; rate: number; rateDate?: string };
type SnapshotCalendarDay = {
  date: string;
  isWorking: boolean;
  dayType: string;
};

@Injectable()
export class DataHubClient {
  private readonly logger = new Logger(DataHubClient.name);
  private readonly baseUrl: string;
  private readonly onPrem: boolean;
  private readonly serviceToken: string | undefined;
  private snapshotCache: {
    fxRates: SnapshotFxRow[];
    calendarDays?: SnapshotCalendarDay[];
    calendar?: { timezone?: string; weekendDays?: number[] };
  } | null = null;

  constructor(config: ConfigService) {
    const raw = config.get<string>("ERA_DATA_HUB_URL") ?? "http://127.0.0.1:4200/registry/v1";
    this.baseUrl = raw.replace(/\/registry\/v1\/?$/, "").replace(/\/$/, "");
    this.onPrem = config.get<string>("ERA_DATA_HUB_ONPREM") === "true";
    this.serviceToken = config.get<string>("DATA_HUB_SERVICE_TOKEN")?.trim();
  }

  private loadSnapshot() {
    if (this.snapshotCache) return this.snapshotCache;
    const candidates = [
      join(process.cwd(), "packages/ref-data-snapshot/snapshot.json"),
      join(process.cwd(), "../packages/ref-data-snapshot/snapshot.json"),
    ];
    for (const path of candidates) {
      if (existsSync(path)) {
        this.snapshotCache = JSON.parse(readFileSync(path, "utf8")) as {
          fxRates: SnapshotFxRow[];
          calendarDays?: SnapshotCalendarDay[];
          calendar?: { timezone?: string; weekendDays?: number[] };
        };
        return this.snapshotCache;
      }
    }
    this.snapshotCache = { fxRates: [] };
    return this.snapshotCache;
  }

  private snapshotCalendarDay(asOf: Date): SnapshotCalendarDay | null {
    const snap = this.loadSnapshot();
    const dateKey = this.isoDateBaku(asOf);
    const hit = snap.calendarDays?.find((d) => d.date === dateKey);
    if (hit) return hit;
    const weekendDays = snap.calendar?.weekendDays ?? [0, 6];
    const dow = asOf.getUTCDay();
    const isWorking = !weekendDays.includes(dow);
    return { date: dateKey, isWorking, dayType: isWorking ? "working" : "weekend" };
  }

  async getCalendarDay(asOf: Date): Promise<{ isWorking: boolean; dayType: string }> {
    const date = this.isoDateBaku(asOf);
    if (this.onPrem) {
      const snap = this.snapshotCalendarDay(asOf);
      return { isWorking: snap?.isWorking ?? false, dayType: snap?.dayType ?? "weekend" };
    }
    try {
      const res = await axios.get(`${this.baseUrl}/registry/v1/calendar/az/day`, {
        params: { date },
        timeout: 5000,
        headers: this.serviceToken
          ? { Authorization: `Bearer ${this.serviceToken}` }
          : undefined,
        validateStatus: () => true,
      });
      if (res.status === 200 && res.data?.date) {
        return { isWorking: Boolean(res.data.isWorking), dayType: String(res.data.dayType) };
      }
    } catch (err) {
      this.logger.warn(`data-hub calendar day failed: ${(err as Error).message}`);
    }
    const snap = this.snapshotCalendarDay(asOf);
    return { isWorking: snap?.isWorking ?? false, dayType: snap?.dayType ?? "weekend" };
  }

  async isWorkingDay(asOf: Date): Promise<boolean> {
    const day = await this.getCalendarDay(asOf);
    return day.isWorking;
  }

  async addBusinessDays(from: Date, n: number): Promise<Date> {
    const date = this.isoDateBaku(from);
    if (!this.onPrem) {
      try {
        const res = await axios.get(`${this.baseUrl}/registry/v1/calendar/az/add-business-days`, {
          params: { date, n },
          timeout: 5000,
          headers: this.serviceToken
          ? { Authorization: `Bearer ${this.serviceToken}` }
          : undefined,
          validateStatus: () => true,
        });
        if (res.status === 200 && res.data?.resultDate) {
          return new Date(`${String(res.data.resultDate).slice(0, 10)}T12:00:00.000Z`);
        }
      } catch (err) {
        this.logger.warn(`data-hub add-business-days failed: ${(err as Error).message}`);
      }
    }
    let cursor = new Date(`${date}T12:00:00.000Z`);
    let added = 0;
    while (added < n) {
      cursor = new Date(cursor.getTime() + 86400000);
      if (await this.isWorkingDay(cursor)) added++;
    }
    return cursor;
  }

  private isoDateBaku(d: Date): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baku",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (!y || !m || !day) return d.toISOString().slice(0, 10);
    return `${y}-${m}-${day}`;
  }

  private snapshotRate(currency: string, asOf: Date): number | null {
    const snap = this.loadSnapshot();
    const code = currency.trim().toUpperCase();
    const dateKey = this.isoDateBaku(asOf);
    const dated = snap.fxRates.find(
      (r) => r.code === code && (!r.rateDate || r.rateDate === dateKey),
    );
    if (dated?.rate != null && Number.isFinite(dated.rate)) return dated.rate;
    const latest = snap.fxRates.find((r) => r.code === code);
    return latest?.rate != null && Number.isFinite(latest.rate) ? latest.rate : null;
  }

  /**
   * FINAL CBAR rate for EOD/treasury posting. Respects asOf (Baku calendar date).
   */
  async getFxRate(currency: string, asOf: Date): Promise<number> {
    const code = currency.trim().toUpperCase();
    if (code === "AZN" || code === "AZM") return 1;

    if (this.onPrem) {
      const snap = this.snapshotRate(code, asOf);
      if (snap != null) return snap;
      throw new Error(`On-prem FX snapshot missing FINAL rate for ${code}`);
    }

    const date = this.isoDateBaku(asOf);
    try {
      const res = await axios.get(`${this.baseUrl}/registry/v1/fx/rates`, {
        params: { symbols: code, date },
        timeout: 5000,
        headers: this.serviceToken
          ? { Authorization: `Bearer ${this.serviceToken}` }
          : undefined,
        validateStatus: () => true,
      });
      if (res.status === 200 && Array.isArray(res.data?.rates)) {
        const row = res.data.rates.find(
          (r: { currencyCode?: string; rate?: number; status?: string }) =>
            r.currencyCode === code && r.status === "FINAL",
        );
        if (row?.rate != null && Number.isFinite(Number(row.rate))) {
          return Number(row.rate);
        }
        const anyRow = res.data.rates.find(
          (r: { currencyCode?: string; rate?: number }) => r.currencyCode === code,
        );
        if (anyRow?.rate != null && Number.isFinite(Number(anyRow.rate))) {
          return Number(anyRow.rate);
        }
      }
    } catch (err) {
      this.logger.warn(`data-hub FX failed: ${(err as Error).message}`);
    }

    const snap = this.snapshotRate(code, asOf);
    if (snap != null) return snap;

    throw new Error(`No FINAL FX rate for ${code} on ${date}`);
  }

  async getBanks(): Promise<Array<{ mfo: string; name: string; swift?: string }>> {
    if (this.onPrem) {
      return this.loadSnapshot().banks ?? [];
    }
    try {
      const res = await axios.get(`${this.baseUrl}/registry/v1/banks`, {
        timeout: 5000,
        headers: this.serviceToken
          ? { Authorization: `Bearer ${this.serviceToken}` }
          : undefined,
        validateStatus: () => true,
      });
      if (res.status === 200 && Array.isArray(res.data?.banks)) {
        return res.data.banks.map(
          (b: { code?: string; nameAz?: string; swift?: string | null }) => ({
            mfo: String(b.code ?? ""),
            name: String(b.nameAz ?? ""),
            swift: b.swift ?? undefined,
          }),
        );
      }
    } catch (err) {
      this.logger.warn(`data-hub banks failed: ${(err as Error).message}`);
    }
    return this.loadSnapshot().banks ?? [];
  }

  async validateIban(iban: string): Promise<{ valid: boolean; message?: string }> {
    if (this.onPrem) {
      const ok = /^AZ\d{2}[A-Z0-9]{24}$/i.test(iban.trim());
      return { valid: ok, message: ok ? undefined : "Invalid IBAN format" };
    }
    try {
      const res = await axios.get(`${this.baseUrl}/registry/v1/iban/validate`, {
        params: { iban: iban.trim() },
        timeout: 5000,
        headers: this.serviceToken
          ? { Authorization: `Bearer ${this.serviceToken}` }
          : undefined,
        validateStatus: () => true,
      });
      if (res.status === 200 && typeof res.data?.valid === "boolean") {
        return { valid: res.data.valid, message: res.data.message };
      }
    } catch (err) {
      this.logger.warn(`data-hub IBAN validate failed: ${(err as Error).message}`);
    }
    return { valid: false, message: "Hub unavailable" };
  }

  async getCoaSubset(): Promise<Array<{ code: string; name: string }>> {
    if (this.onPrem) {
      return this.loadSnapshot().coaSubset ?? [];
    }
    try {
      const res = await axios.get(`${this.baseUrl}/registry/v1/chart-of-accounts`, {
        params: { profile: "commercial" },
        timeout: 8000,
        headers: this.serviceToken
          ? { Authorization: `Bearer ${this.serviceToken}` }
          : undefined,
        validateStatus: () => true,
      });
      if (res.status === 200 && res.data?.accounts) {
        const raw = Array.isArray(res.data.accounts)
          ? res.data.accounts
          : res.data.accounts?.accounts;
        if (Array.isArray(raw)) {
          return raw.slice(0, 50).map((a: { code?: string; name?: string }) => ({
            code: String(a.code ?? ""),
            name: String(a.name ?? a.nameAz ?? ""),
          }));
        }
      }
    } catch (err) {
      this.logger.warn(`data-hub CoA failed: ${(err as Error).message}`);
    }
    return this.loadSnapshot().coaSubset ?? [];
  }
}
