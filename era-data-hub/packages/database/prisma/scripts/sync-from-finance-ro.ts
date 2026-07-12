/**
 * Phase 1 cutover: copy reference tables from finance RO into era_data_hub.
 * Requires FINANCE_RO_DATABASE_URL (read-only) and DATABASE_URL (hub).
 */
import "dotenv/config";
import { PrismaClient as FinancePrisma } from "@erafinance/database";
import { PrismaClient as HubPrisma } from "../../generated/client";

const financeUrl = process.env.FINANCE_RO_DATABASE_URL?.trim();
const hubUrl = process.env.DATABASE_URL?.trim();
if (!financeUrl || !hubUrl) {
  console.error("FINANCE_RO_DATABASE_URL and DATABASE_URL are required");
  process.exit(1);
}

const finance = new FinancePrisma({
  datasources: { db: { url: financeUrl } },
} as ConstructorParameters<typeof FinancePrisma>[0]);
const hub = new HubPrisma();

async function copyTable<T>(
  label: string,
  load: () => Promise<T[]>,
  save: (rows: T[]) => Promise<void>,
): Promise<void> {
  const rows = await load();
  await save(rows);
  console.info(`[sync] ${label}: ${rows.length} rows`);
}

async function main() {
  await copyTable("cbar_official_rates", () => finance.cbarOfficialRate.findMany(), async (rows) => {
    for (const r of rows) {
      await hub.cbarOfficialRate.upsert({
        where: { rateDate_currencyCode: { rateDate: r.rateDate, currencyCode: r.currencyCode } },
        create: {
          rateDate: r.rateDate,
          currencyCode: r.currencyCode,
          value: r.value,
          nominal: r.nominal,
          rate: r.rate,
          status: r.status,
        },
        update: {
          value: r.value,
          nominal: r.nominal,
          rate: r.rate,
          status: r.status,
        },
      });
    }
  });

  await copyTable("global_company_directory", () => finance.globalCompanyDirectory.findMany(), async (rows) => {
    for (const r of rows) {
      await hub.globalCompanyDirectory.upsert({
        where: { taxId: r.taxId },
        create: {
          taxId: r.taxId,
          name: r.name,
          legalForm: r.legalForm,
          legalAddress: r.legalAddress,
          phone: r.phone,
          directorName: r.directorName,
        },
        update: {
          name: r.name,
          legalForm: r.legalForm,
          legalAddress: r.legalAddress,
          phone: r.phone,
          directorName: r.directorName,
        },
      });
    }
  });

  const banks = await finance.bankGlossary.findMany({ include: { branches: true } });
  for (const b of banks) {
    const bank = await hub.bankGlossary.upsert({
      where: { voen: b.voen },
      create: {
        nameAz: b.nameAz,
        voen: b.voen,
        code: b.code,
        correspondentIban: b.correspondentIban,
        swift: b.swift,
        headPhones: b.headPhones,
        headAddress: b.headAddress,
        isActive: b.isActive,
      },
      update: {
        nameAz: b.nameAz,
        correspondentIban: b.correspondentIban,
        swift: b.swift,
        headPhones: b.headPhones,
        headAddress: b.headAddress,
        isActive: b.isActive,
      },
    });
    for (const br of b.branches) {
      await hub.bankBranch.upsert({
        where: { bankId_branchCode: { bankId: bank.id, branchCode: br.branchCode } },
        create: {
          bankId: bank.id,
          branchCode: br.branchCode,
          name: br.name,
          swift: br.swift,
          address: br.address,
          phones: br.phones,
          isHeadOffice: br.isHeadOffice,
          isActive: br.isActive,
        },
        update: {
          name: br.name,
          swift: br.swift,
          address: br.address,
          phones: br.phones,
          isHeadOffice: br.isHeadOffice,
          isActive: br.isActive,
        },
      });
    }
  }
  console.info(`[sync] bank_glossary: ${banks.length} banks`);

  await copyTable("customs_tariff_rates", () => finance.customsTariffRate.findMany({ where: { deletedAt: null } }), async (rows) => {
    for (const r of rows) {
      await hub.customsTariffRate.upsert({
        where: { hsCode_effectiveFrom: { hsCode: r.hsCode, effectiveFrom: r.effectiveFrom } },
        create: {
          hsCode: r.hsCode,
          description: r.description,
          dutyRatePercent: r.dutyRatePercent,
          vatRatePercent: r.vatRatePercent,
          excisePercent: r.excisePercent,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo,
          notes: r.notes,
        },
        update: {
          description: r.description,
          dutyRatePercent: r.dutyRatePercent,
          vatRatePercent: r.vatRatePercent,
          excisePercent: r.excisePercent,
          effectiveTo: r.effectiveTo,
          notes: r.notes,
        },
      });
    }
  });

  await copyTable("units_of_measure", () => finance.unitOfMeasure.findMany(), async (rows) => {
    for (const r of rows) {
      await hub.unitOfMeasure.upsert({
        where: { code: r.code },
        create: {
          code: r.code,
          kind: r.kind,
          baseCode: r.baseCode,
          factor: r.factor,
          nameAz: r.nameAz,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          isActive: r.isActive,
          sortOrder: r.sortOrder,
        },
        update: {
          kind: r.kind,
          baseCode: r.baseCode,
          factor: r.factor,
          nameAz: r.nameAz,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          isActive: r.isActive,
          sortOrder: r.sortOrder,
        },
      });
    }
  });

  await copyTable("countries", () => finance.country.findMany(), async (rows) => {
    for (const r of rows) {
      await hub.country.upsert({
        where: { iso2: r.iso2 },
        create: {
          iso2: r.iso2,
          iso3: r.iso3,
          dialingCode: r.dialingCode,
          currencyCode: r.currencyCode,
          nameAz: r.nameAz,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          sortOrder: r.sortOrder,
        },
        update: {
          iso3: r.iso3,
          dialingCode: r.dialingCode,
          currencyCode: r.currencyCode,
          nameAz: r.nameAz,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          sortOrder: r.sortOrder,
        },
      });
    }
  });

  await copyTable("cities", () => finance.city.findMany(), async (rows) => {
    for (const r of rows) {
      await hub.city.upsert({
        where: { code: r.code },
        create: {
          code: r.code,
          countryIso2: r.countryIso2,
          region: r.region,
          isCapital: r.isCapital,
          nameAz: r.nameAz,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          sortOrder: r.sortOrder,
        },
        update: {
          region: r.region,
          isCapital: r.isCapital,
          nameAz: r.nameAz,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          sortOrder: r.sortOrder,
        },
      });
    }
  });

  await copyTable("tax_rates", () => finance.taxRate.findMany(), async (rows) => {
    for (const r of rows) {
      await hub.taxRate.upsert({
        where: { code: r.code },
        create: {
          code: r.code,
          kind: r.kind,
          region: r.region,
          percent: r.percent,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo,
          nameAz: r.nameAz,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          sortOrder: r.sortOrder,
          isActive: r.isActive,
        },
        update: {
          kind: r.kind,
          region: r.region,
          percent: r.percent,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo,
          nameAz: r.nameAz,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          sortOrder: r.sortOrder,
          isActive: r.isActive,
        },
      });
    }
  });

  await copyTable("currencies", () => finance.currency.findMany(), async (rows) => {
    for (const r of rows) {
      await hub.currency.upsert({
        where: { code: r.code },
        create: {
          code: r.code,
          symbol: r.symbol,
          decimals: r.decimals,
          nameAz: r.nameAz,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          sortOrder: r.sortOrder,
          isActive: r.isActive,
        },
        update: {
          symbol: r.symbol,
          decimals: r.decimals,
          nameAz: r.nameAz,
          nameRu: r.nameRu,
          nameEn: r.nameEn,
          sortOrder: r.sortOrder,
          isActive: r.isActive,
        },
      });
    }
  });

  console.info("[sync] done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await finance.$disconnect();
    await hub.$disconnect();
  });
