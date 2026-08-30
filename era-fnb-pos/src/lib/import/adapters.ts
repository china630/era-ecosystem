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

function toDecimal(n: number) {
  return new Prisma.Decimal(n);
}

async function defaultOutlet(tx: ImportTx) {
  const orgId = requestOrganizationId();
  const existing = await tx.outlet.findFirst({
    where: { OR: [{ code: "RESTAURANT" }, { code: "XUDMANI" }] },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return tx.outlet.create({
    data: {
      organizationId: orgId,
      code: "RESTAURANT",
      name: "Nafta Restaurant",
      revenueCenterCode: "FOOD",
    },
  });
}

const groupSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number(),
  active: z.boolean(),
});

export const productGroupsAdapter: ImportAdapter<z.infer<typeof groupSchema>> = {
  entity: "product-groups",
  label: "Product groups",
  order: 30,
  templateHint: "30-Product-Group-List.xlsx — EW Product Group List",
  headerAliases: {
    "Group Code": "code",
    "Product Group Name": "name",
    "Display Order": "sortOrder",
    Disabled: "disabled",
    "Pos Active": "posActive",
  },
  rowSchema: groupSchema,
  mapRow: (raw) => {
    const name = cellString(raw.name);
    if (!name) return null;
    return {
      code: cellString(raw.code) ?? slugCode(name),
      name,
      sortOrder: cellNumber(raw.sortOrder) ?? 0,
      active: !(cellBool(raw.disabled) || cellString(raw.posActive)?.toLowerCase() === "false"),
    };
  },
  upsert: async (tx, row, dryRun) => {
    const outlet = await defaultOutlet(tx);
    const existing = await tx.menuCategory.findFirst({
      where: { outletId: outlet.id, name: row.name },
    });
    if (dryRun) return existing ? "updated" : "created";
    if (!existing) {
      await tx.menuCategory.create({
        data: {
          organizationId: requestOrganizationId(),
          outletId: outlet.id,
          name: row.name,
          sortOrder: row.sortOrder,
        },
      });
      return "created";
    }
    await tx.menuCategory.update({
      where: { id: existing.id },
      data: { sortOrder: row.sortOrder },
    });
    return "updated";
  },
};

const cardSchema = z.object({
  plu: z.string().min(1),
  name: z.string().min(1),
  groupName: z.string().nullable().optional(),
  price: z.number(),
  active: z.boolean(),
});

export const productCardsAdapter: ImportAdapter<z.infer<typeof cardSchema>> = {
  entity: "product-cards",
  label: "Product cards (menu)",
  order: 31,
  templateHint: "31-Product-Cards.xlsx — EW Ürün Kartları",
  headerAliases: {
    Id: "ewId",
    "Ürün Kodu": "code",
    "Ürün Adı": "name",
    "Ürün Grubu Adı": "groupName",
    Fiyat: "price",
    "İndirim Aktif": "active",
  },
  rowSchema: cardSchema,
  mapRow: (raw) => {
    const name = cellString(raw.name);
    if (!name) return null;
    const ewId = cellString(raw.ewId) ?? (raw.ewId != null ? String(raw.ewId) : null);
    return {
      plu: cellString(raw.code) ?? (ewId ? `ERA-FNB-${ewId}` : slugCode(name)),
      name,
      groupName: cellString(raw.groupName),
      price: cellNumber(raw.price) ?? 0,
      active: raw.active === undefined ? true : cellBool(raw.active),
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
          sortOrder: 99,
        },
      });
    }
    if (dryRun) return "created";
    if (!category) throw new Error("Category missing");
    const existing = await tx.menuItem.findFirst({
      where: { categoryId: category.id, plu: row.plu },
    });
    const data = {
      name: row.name,
      priceAzn: toDecimal(row.price),
      active: row.active,
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
  templateHint: "32-FnB-Transactions.xlsx — EW 999 FB / Xudmani CASH (not hotel folio)",
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
