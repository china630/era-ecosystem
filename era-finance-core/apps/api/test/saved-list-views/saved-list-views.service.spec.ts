import { BadRequestException } from "@nestjs/common";
import { SavedListViewsService } from "../../src/saved-list-views/saved-list-views.service";
import type { PrismaService } from "../../src/prisma/prisma.service";

describe("SavedListViewsService (AC-FIN-VIEW)", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";
  const userId = "00000000-0000-0000-0000-000000000002";

  it("rejects unknown column in config", async () => {
    const prisma = {
      savedListView: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    const svc = new SavedListViewsService(prisma);
    await expect(
      svc.create(orgId, userId, "ACCOUNTANT", {
        gridKey: "FINANCE_INVOICE_LIST",
        name: "Bad",
        config: {
          version: 1,
          columns: ["number", "driver"],
          filters: {},
          pageSize: 25,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persists normalized config", async () => {
    const create = jest.fn().mockResolvedValue({ id: "v1" });
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      savedListView: {
        count: jest.fn().mockResolvedValue(0),
        create,
        updateMany,
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          savedListView: { create, updateMany },
        }),
      ),
    } as unknown as PrismaService;
    const svc = new SavedListViewsService(prisma);
    await svc.create(orgId, userId, "ACCOUNTANT", {
      gridKey: "FINANCE_INVOICE_LIST",
      name: "Open",
      isDefault: true,
      config: {
        version: 1,
        columns: ["number", "status"],
        filters: { status: "SENT" },
        sort: { key: "dueDate", dir: "asc" },
        pageSize: 50,
      },
    });
    expect(create).toHaveBeenCalled();
    const arg = create.mock.calls[0][0];
    expect(arg.data.configJson.columns).toContain("actions");
    expect(arg.data.configJson.filters).toEqual({ status: "SENT" });
    expect(arg.data.isDefault).toBe(true);
  });

  it("rejects invalid status filter value", async () => {
    const prisma = {
      savedListView: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
    const svc = new SavedListViewsService(prisma);
    await expect(
      svc.create(orgId, userId, "ACCOUNTANT", {
        gridKey: "FINANCE_INVOICE_LIST",
        name: "BadStatus",
        config: {
          columns: ["number", "actions"],
          filters: { status: "NOT_A_STATUS" },
          pageSize: 25,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects dueFrom after dueTo", async () => {
    const prisma = {
      savedListView: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
    const svc = new SavedListViewsService(prisma);
    await expect(
      svc.create(orgId, userId, "ACCOUNTANT", {
        gridKey: "FINANCE_INVOICE_LIST",
        name: "BadDates",
        config: {
          columns: ["number", "actions"],
          filters: { dueFrom: "2026-12-01", dueTo: "2026-01-01" },
          pageSize: 25,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects shared view for ACCOUNTANT", async () => {
    const prisma = {
      savedListView: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
    const svc = new SavedListViewsService(prisma);
    await expect(
      svc.create(orgId, userId, "ACCOUNTANT", {
        gridKey: "FINANCE_INVOICE_LIST",
        name: "Shared",
        isShared: true,
        config: {
          columns: ["number", "actions"],
          filters: {},
          pageSize: 25,
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
