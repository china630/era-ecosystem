import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  cellBool,
  cellMoney,
  cellNumber,
  cellString,
  parseDateCell,
  slugCode,
} from "@/lib/import/helpers";
import type { ImportAdapter, ImportEntityMeta, ImportTx } from "@/lib/import/types";
import { categoryCodeFromName } from "@/lib/business-day";

function toDecimal(n: number) {
  return new Prisma.Decimal(n);
}

async function defaultOutlet(tx: ImportTx) {
  const kafe = await tx.outlet.findFirst({
    where: { code: "KAFE", active: true },
  });
  if (kafe) return kafe;
  const existing = await tx.outlet.findFirst({
    where: {
      OR: [{ code: "NAFTANI" }, { code: "XUDMANI" }],
      active: true,
    },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  const any = await tx.outlet.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (any) return any;
  throw new Error("No active outlet — create NAFTANI/XUDMANI/KAFE in Settings before import");
}

async function resolveRevenueCode(token: string | null | undefined): Promise<string | null> {
  const key = token?.trim();
  if (!key) return null;
  const { listHotelRevenueCodes, resolveHotelRevenueKey, resolveCatalogOrganizationId } =
    await import("@era/satellite-kit");
  const hubOrg = await resolveCatalogOrganizationId(requestOrganizationId());
  const rows = await listHotelRevenueCodes(hubOrg);
  const resolved = resolveHotelRevenueKey(rows, key);
  if (!resolved) {
    throw new Error(`Revenue code ${key} was not found in the hotel catalog`);
  }
  return resolved;
}

const groupSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number(),
  active: z.boolean(),
  revenueCode: z.string().nullable().optional(),
});

export const productGroupsAdapter: ImportAdapter<z.infer<typeof groupSchema>> = {
  entity: "product-groups",
  label: "Product groups",
  order: 30,
  templateHint: "30-Product-Groups.xlsx — Group Code, Product Group Name, Revenue Code, Display Order, Active",
  headerAliases: {
    "Group Code": "code",
    "Product Group Name": "name",
    "Revenue Code": "revenueCode",
    "Display Order": "sortOrder",
    Active: "active",
  },
  rowSchema: groupSchema,
  mapRow: (raw) => {
    const name = cellString(raw.name);
    if (!name) return null;
    const activeRaw = raw.active;
    return {
      code: cellString(raw.code) ?? slugCode(name),
      name,
      sortOrder: cellNumber(raw.sortOrder) ?? 0,
      active: activeRaw === undefined || activeRaw === "" ? true : cellBool(activeRaw),
      revenueCode: cellString(raw.revenueCode),
    };
  },
  upsert: async (tx, row, dryRun) => {
    const outlet = await defaultOutlet(tx);
    const revenueCode = row.revenueCode
      ? await resolveRevenueCode(row.revenueCode)
      : null;
    const existing = await tx.menuCategory.findFirst({
      where: { outletId: outlet.id, OR: [{ name: row.name }, { code: row.code }] },
    });
    if (dryRun) return existing ? "updated" : "created";
    const data = {
      name: row.name,
      code: row.code,
      sortOrder: row.sortOrder,
      ...(revenueCode ? { revenueCode } : {}),
    };
    if (!existing) {
      await tx.menuCategory.create({
        data: {
          organizationId: requestOrganizationId(),
          outletId: outlet.id,
          ...data,
          code: row.code || categoryCodeFromName(row.name, `C${row.sortOrder}`),
        },
      });
      return "created";
    }
    await tx.menuCategory.update({
      where: { id: existing.id },
      data,
    });
    return "updated";
  },
};

const cardSchema = z.object({
  plu: z.string().min(1),
  name: z.string().min(1),
  groupName: z.string().nullable().optional(),
  revenueCode: z.string().nullable().optional(),
  price: z.number(),
  active: z.boolean(),
  financeSku: z.string().nullable().optional(),
  recipeSku: z.string().nullable().optional(),
});

export const productCardsAdapter: ImportAdapter<z.infer<typeof cardSchema>> = {
  entity: "product-cards",
  label: "Product cards (menu)",
  order: 31,
  templateHint:
    "31-Product-Cards.xlsx — Product Code, Product Name, Product Group Name, Price, Active, Finance SKU, Recipe SKU, Revenue Code",
  headerAliases: {
    Id: "ewId",
    "Product Code": "code",
    "Product Name": "name",
    "Product Group Name": "groupName",
    "Revenue Code": "revenueCode",
    Price: "price",
    Active: "active",
    "Finance SKU": "financeSku",
    "Recipe SKU": "recipeSku",
  },
  rowSchema: cardSchema,
  mapRow: (raw) => {
    const name = cellString(raw.name);
    if (!name) return null;
    const ewId = cellString(raw.ewId) ?? (raw.ewId != null ? String(raw.ewId) : null);
    const plu = cellString(raw.code) ?? (ewId ? `ERA-FNB-${ewId}` : slugCode(name));
    const activeRaw = raw.active;
    return {
      plu,
      name,
      groupName: cellString(raw.groupName),
      revenueCode: cellString(raw.revenueCode),
      price: cellNumber(raw.price) ?? 0,
      active: activeRaw === undefined || activeRaw === "" ? true : cellBool(activeRaw),
      financeSku: cellString(raw.financeSku) ?? plu,
      recipeSku: cellString(raw.recipeSku),
    };
  },
  upsert: async (tx, row, dryRun) => {
    const outlet = await defaultOutlet(tx);
    const groupName = row.groupName ?? "Uncategorized";
    let category = await tx.menuCategory.findFirst({
      where: { outletId: outlet.id, name: groupName },
    });
    if (!category && !dryRun) {
      category = await tx.menuCategory.create({
        data: {
          organizationId: requestOrganizationId(),
          outletId: outlet.id,
          name: groupName,
          code: categoryCodeFromName(groupName, "C99"),
          sortOrder: 99,
        },
      });
    }
    if (dryRun) return "created";
    if (!category) throw new Error("Category missing");
    const revenueCode = row.revenueCode ? await resolveRevenueCode(row.revenueCode) : null;
    if (revenueCode && (!category.revenueCode || category.revenueCode !== revenueCode)) {
      category = await tx.menuCategory.update({
        where: { id: category.id },
        data: { revenueCode },
      });
    }
    const existing = await tx.menuItem.findFirst({
      where: { categoryId: category.id, plu: row.plu },
    });
    const data = {
      name: row.name,
      priceAzn: toDecimal(row.price),
      active: row.active,
      financeSku: row.financeSku ?? row.plu,
      recipeSku: row.recipeSku ?? null,
      revenueCode: null,
    };
    if (!existing) {
      await tx.menuItem.create({
        data: {
          organizationId: requestOrganizationId(),
          categoryId: category.id,
          plu: row.plu,
          ...data,
        },
      });
      return "created";
    }
    await tx.menuItem.update({ where: { id: existing.id }, data });
    return "updated";
  },
};

const txSchema = z.object({
  externalRef: z.string().min(1),
  description: z.string().min(1),
  amount: z.number(),
  guestName: z.string().nullable().optional(),
  at: z.date(),
});

export const fnbTransactionsAdapter: ImportAdapter<z.infer<typeof txSchema>> = {
  entity: "fnb-transactions",
  label: "FnB cheques (archive)",
  order: 32,
  templateHint: "32-FnB-Transactions.xlsx — Id, Income, Local Amount, Guest Name, Date, Notes",
  headerAliases: {
    Id: "ewId",
    "POS Id": "posId",
    Income: "income",
    "Local Amount": "amount",
    "Guest Name": "guestName",
    Date: "at",
    Notes: "notes",
  },
  rowSchema: txSchema,
  mapRow: (raw) => {
    const notes = (cellString(raw.notes) ?? "").toUpperCase();
    if (notes.includes("POS PAYMENT")) return null;
    const amount = cellMoney(raw.amount) ?? cellNumber(raw.amount);
    if (amount == null || amount <= 0) return null;
    const ewId = cellString(raw.ewId) ?? (raw.ewId != null ? String(raw.ewId) : null);
    if (!ewId) return null;
    const description = cellString(raw.income) ?? cellString(raw.notes) ?? "FnB sale";
    return {
      externalRef: `ew:fnb:${ewId}`,
      description,
      amount,
      guestName: cellString(raw.guestName),
      at: parseDateCell(raw.at) ?? new Date(),
    };
  },
  upsert: async (tx, row, dryRun) => {
    const outlet = await defaultOutlet(tx);
    const existing = await tx.ticket.findFirst({ where: { externalRef: row.externalRef } });
    if (dryRun) return existing ? "updated" : "created";
    const orgId = requestOrganizationId();
    const ticket =
      existing ??
      (await tx.ticket.create({
        data: {
          organizationId: orgId,
          outletId: outlet.id,
          status: "CLOSED",
          guestName: row.guestName,
          walkInLabel: row.guestName,
          serviceChannel: "WALKIN",
          subtotalAzn: toDecimal(row.amount),
          totalAzn: toDecimal(row.amount),
          openedAt: row.at,
          closedAt: row.at,
          externalRef: row.externalRef,
        },
      }));
    if (existing) {
      await tx.ticket.update({
        where: { id: existing.id },
        data: {
          guestName: row.guestName,
          walkInLabel: row.guestName,
          subtotalAzn: toDecimal(row.amount),
          totalAzn: toDecimal(row.amount),
          openedAt: row.at,
          closedAt: row.at,
          status: "CLOSED",
        },
      });
      await tx.ticketLine.deleteMany({ where: { ticketId: existing.id } });
    }
    await tx.ticketLine.create({
      data: {
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        description: row.description,
        qty: 1,
        unitPriceAzn: toDecimal(row.amount),
      },
    });
    return existing ? "updated" : "created";
  },
};

const ADAPTERS = [
  productGroupsAdapter,
  productCardsAdapter,
  fnbTransactionsAdapter,
] as ImportAdapter<unknown>[];

export function getImportAdapter(entity: string) {
  return ADAPTERS.find((a) => a.entity === entity);
}

export function listImportEntities(): ImportEntityMeta[] {
  return ADAPTERS.map(({ entity, label, order, templateHint, fileless, allowMultiple }) => ({
    entity,
    label,
    order,
    templateHint,
    fileless,
    allowMultiple,
  })).sort((a, b) => a.order - b.order);
}
