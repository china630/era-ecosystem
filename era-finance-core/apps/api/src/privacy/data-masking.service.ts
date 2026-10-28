import { Injectable } from "@nestjs/common";
import { isAuditPiiKey } from "@era/satellite-kit";

export const MASKED = "***MASKED***";

/** Normalized key: lowercase, no `_` or `-`. */
export function normalizeSensitiveKey(key: string): string {
  return key.replace(/[_-]/g, "").toLowerCase();
}

/**
 * Finance-only extras beyond kit `isAuditPiiKey` (AC-FIN-AUD kit align).
 * Kit covers password/token/fin/email/iban/account/cvv/pin families.
 */
const FINANCE_EXTRA_SENSITIVE_KEYS: readonly string[] = [
  "balance",
  "balances",
  "creditcard",
  "adminpassword",
  "currentpassword",
  "idtoken",
  "clientsecret",
];

@Injectable()
export class DataMaskingService {
  private readonly financeExtra: ReadonlySet<string>;

  constructor() {
    this.financeExtra = new Set(
      FINANCE_EXTRA_SENSITIVE_KEYS.map(normalizeSensitiveKey),
    );
  }

  isSensitiveKey(key: string): boolean {
    if (isAuditPiiKey(key)) return true;
    return this.financeExtra.has(normalizeSensitiveKey(key));
  }

  /**
   * Рекурсивно маскирует значения по имени ключа (без учёта регистра и `_`/`-`).
   * JSON-строки (объект/массив) в строковых полях разбираются и маскируются внутри.
   */
  maskDeep(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === "string") {
      const t = value.trim();
      if (
        (t.startsWith("{") && t.endsWith("}")) ||
        (t.startsWith("[") && t.endsWith("]"))
      ) {
        try {
          return this.maskDeep(JSON.parse(value) as unknown);
        } catch {
          return value;
        }
      }
      return value;
    }
    if (typeof value !== "object") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.maskDeep(item));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (this.isSensitiveKey(k)) {
        out[k] = MASKED;
      } else {
        out[k] = this.maskDeep(v);
      }
    }
    return out;
  }

  /** Короткая строка для application logs (не БД). */
  maskForLogSnippet(value: unknown, maxLen: number): string {
    const masked = this.maskDeep(value);
    const s =
      typeof masked === "string" ? masked : JSON.stringify(masked ?? null);
    return s.length <= maxLen ? s : `${s.slice(0, maxLen)}…`;
  }
}
