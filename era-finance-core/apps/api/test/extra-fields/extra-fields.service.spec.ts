import { BadRequestException } from "@nestjs/common";
import { ExtraFieldsService } from "../../src/extra-fields/extra-fields.service";
import type { PrismaService } from "../../src/prisma/prisma.service";

describe("ExtraFieldsService.normalizeForEntity (AC-FIN-EXT)", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";

  it("rejects unknown invoice extra keys", async () => {
    const prisma = {
      extraFieldDefinition: {
        findMany: jest.fn().mockResolvedValue([
          {
            key: "vehicle_plate",
            valueKind: "TEXT",
            catalogFieldKind: "FREE_TEXT",
            required: false,
            active: true,
            optionsJson: null,
          },
        ]),
      },
    } as unknown as PrismaService;
    const svc = new ExtraFieldsService(prisma);
    await expect(
      svc.normalizeForEntity(orgId, "FINANCE_INVOICE", {
        vehicle_plate: "10-AA-100",
        driver_name: "X",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts known keys", async () => {
    const prisma = {
      extraFieldDefinition: {
        findMany: jest.fn().mockResolvedValue([
          {
            key: "vehicle_plate",
            valueKind: "TEXT",
            catalogFieldKind: "FREE_TEXT",
            required: false,
            active: true,
            optionsJson: null,
          },
        ]),
      },
    } as unknown as PrismaService;
    const svc = new ExtraFieldsService(prisma);
    await expect(
      svc.normalizeForEntity(orgId, "FINANCE_INVOICE", {
        vehicle_plate: "10-AA-100",
      }),
    ).resolves.toEqual({ vehicle_plate: "10-AA-100" });
  });

  it("strips retired keys instead of 400", async () => {
    const prisma = {
      extraFieldDefinition: {
        findMany: jest.fn().mockResolvedValue([
          {
            key: "vehicle_plate",
            valueKind: "TEXT",
            catalogFieldKind: "FREE_TEXT",
            required: false,
            active: false,
            optionsJson: null,
          },
          {
            key: "region",
            valueKind: "SELECT",
            catalogFieldKind: "CLOSED_SMALL",
            required: true,
            active: true,
            optionsJson: [{ value: "BAKU" }],
          },
        ]),
      },
    } as unknown as PrismaService;
    const svc = new ExtraFieldsService(prisma);
    await expect(
      svc.normalizeForEntity(orgId, "FINANCE_INVOICE", {
        vehicle_plate: "x",
        region: "BAKU",
      }),
    ).resolves.toEqual({ region: "BAKU" });
  });

  it("rejects SELECT definitions without options", async () => {
    const prisma = {
      extraFieldDefinition: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    const svc = new ExtraFieldsService(prisma);
    await expect(
      svc.create(orgId, {
        entityType: "FINANCE_INVOICE",
        key: "region",
        valueKind: "SELECT",
        labelAz: "Region",
        labelEn: "Region",
        labelRu: "Region",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects blank labels on patch", async () => {
    const prisma = {
      extraFieldDefinition: {
        findFirst: jest.fn().mockResolvedValue({
          id: "def-1",
          organizationId: orgId,
          valueKind: "TEXT",
        }),
        update: jest.fn(),
      },
    } as unknown as PrismaService;
    const svc = new ExtraFieldsService(prisma);
    await expect(
      svc.patch(orgId, "def-1", { labelAz: "   " }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
