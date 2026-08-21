import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OrganizationKind } from "@prisma/client";
import {
  cashProfileForNasCode,
  isNasBankLedgerCode,
  isNasCashDeskCode,
  normalizeChartAccountSeedRow,
  organizationKindToPayrollSettingsTemplateGroup,
  type ChartOfAccountsFile,
} from "./chart-seed";

function loadJsonFile(relFromLib: string): ChartOfAccountsFile {
  const p = join(__dirname, relFromLib);
  return JSON.parse(readFileSync(p, "utf-8")) as ChartOfAccountsFile;
}

function validateAccounts(accounts: ReturnType<typeof normalizeChartAccountSeedRow>[]) {
  const codes = new Set<string>();
  for (const a of accounts) {
    expect(a.code.length).toBeGreaterThan(0);
    expect(codes.has(a.code)).toBe(false);
    codes.add(a.code);
  }
  const byCode = new Map(accounts.map((r) => [r.code, r]));
  for (const a of accounts) {
    if (a.parentCode) {
      expect(byCode.has(a.parentCode)).toBe(true);
    }
  }
}

describe("chart-seed NAS JSON catalogs", () => {
  it.each([
    ["commercial", OrganizationKind.COMMERCIAL],
    ["budget", OrganizationKind.BUDGET],
    ["ngo", OrganizationKind.NGO],
  ] as const)("loads %s chart", (_slug, kind) => {
    const slug = kind.toLowerCase();
    const parsed = loadJsonFile(`../../catalog/national/chart-of-accounts-${slug}.json`);
    expect(parsed.accounts.length).toBeGreaterThan(0);
    const rows = (parsed.accounts as Record<string, unknown>[]).map(normalizeChartAccountSeedRow);
    validateAccounts(rows);
  });

  it("maps OrganizationKind to payroll settings.templateGroup", () => {
    expect(organizationKindToPayrollSettingsTemplateGroup(OrganizationKind.COMMERCIAL)).toBe(
      "COMMERCIAL",
    );
    expect(organizationKindToPayrollSettingsTemplateGroup(OrganizationKind.NGO)).toBe(
      "COMMERCIAL",
    );
    expect(organizationKindToPayrollSettingsTemplateGroup(OrganizationKind.BUDGET)).toBe(
      "GOVERNMENT",
    );
  });

  it("assigns cash profiles by official chart (Q-01 221 commercial, NAS-GOV 101 budget, İ-05 221 NGO)", () => {
    expect(cashProfileForNasCode(OrganizationKind.BUDGET, "101")).toBe("AZN");
    expect(cashProfileForNasCode(OrganizationKind.BUDGET, "221")).toBeNull();
    expect(cashProfileForNasCode(OrganizationKind.COMMERCIAL, "101")).toBeNull();
    expect(cashProfileForNasCode(OrganizationKind.COMMERCIAL, "221")).toBe("AZN");
    expect(cashProfileForNasCode(OrganizationKind.COMMERCIAL, "221.01")).toBe("AZN");
    expect(cashProfileForNasCode(OrganizationKind.COMMERCIAL, "221.11")).toBe("FX");
    expect(cashProfileForNasCode(OrganizationKind.COMMERCIAL, "223")).toBeNull();
    expect(cashProfileForNasCode(OrganizationKind.NGO, "221")).toBe("AZN");
    expect(cashProfileForNasCode(OrganizationKind.NGO, "222")).toBeNull();
  });

  it("maps official kassa vs bank codes per kind", () => {
    expect(isNasCashDeskCode(OrganizationKind.COMMERCIAL, "221")).toBe(true);
    expect(isNasCashDeskCode(OrganizationKind.COMMERCIAL, "223")).toBe(false);
    expect(isNasBankLedgerCode(OrganizationKind.COMMERCIAL, "223")).toBe(true);
    expect(isNasBankLedgerCode(OrganizationKind.COMMERCIAL, "221")).toBe(false);
    expect(isNasCashDeskCode(OrganizationKind.BUDGET, "101")).toBe(true);
    expect(isNasBankLedgerCode(OrganizationKind.BUDGET, "103")).toBe(true);
    expect(isNasCashDeskCode(OrganizationKind.BUDGET, "221")).toBe(false);
    expect(isNasCashDeskCode(OrganizationKind.NGO, "221")).toBe(true);
    expect(isNasBankLedgerCode(OrganizationKind.NGO, "223")).toBe(true);
  });

  it("COMMERCIAL chart uses Q-01 221 kassa / 223 bank, not NAS-GOV 101", () => {
    const parsed = loadJsonFile("../../catalog/national/chart-of-accounts-commercial.json");
    const byCode = new Map(
      (parsed.accounts as Record<string, unknown>[]).map((r) => [
        String(r.code ?? "").trim(),
        r,
      ]),
    );
    expect(byCode.has("101")).toBe(false);
    expect(String(byCode.get("221")?.nameAz ?? "")).toMatch(/Kassa/i);
    expect(String(byCode.get("223")?.nameAz ?? "")).toMatch(/Bank/i);
  });

  it("BUDGET chart includes account 101 (government cash)", () => {
    const parsed = loadJsonFile("../../catalog/national/chart-of-accounts-budget.json");
    const codes = new Set(
      (parsed.accounts as Record<string, unknown>[]).map((r) => String(r.code ?? "").trim()),
    );
    expect(codes.has("101")).toBe(true);
  });
});
