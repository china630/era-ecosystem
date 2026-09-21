import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { UserRole } from "@erafinance/database";
import { CP_PERMISSION } from "@era/contracts";
import request from "supertest";
import type { NextFunction, Request, Response } from "express";
import { OpeningBalancesController } from "../../src/migration/opening-balances.controller";
import { OpeningBalancesService } from "../../src/migration/opening-balances.service";
import { PermissionsGuard } from "../../src/common/guards/permissions.guard";

describe("OpeningBalancesController /finance (HTTP e2e, PermissionsGuard)", () => {
  jest.setTimeout(60_000);
  let app: INestApplication;
  const service = {
    importFinance: jest.fn(),
    importHr: jest.fn(),
    importInventory: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OpeningBalancesController],
      providers: [
        { provide: OpeningBalancesService, useValue: service },
        PermissionsGuard,
        Reflector,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const role = String(req.headers["x-role"] ?? "").toUpperCase();
      const organizationId = String(
        req.headers["x-org"] ?? "00000000-0000-0000-0000-000000000001",
      );
      const rawPerms = req.headers["x-permissions"];
      const permissions =
        rawPerms === undefined
          ? undefined
          : String(rawPerms)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
      const isOwner = String(req.headers["x-owner"] ?? "") === "1";
      req.user = role
        ? { userId: "u-1", organizationId, role, permissions, isOwner }
        : undefined;
      req.params = { ...(req.params ?? {}), organizationId };
      req.headers["x-organization-id"] = organizationId;
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validBody = [
    {
      accountCode: "101",
      amount: 10000,
      currency: "AZN",
      date: "2026-04-27",
      description: "Opening cash",
    },
  ];

  it("allows ACCOUNTANT when JWT includes api:ledger.post", async () => {
    service.importFinance.mockResolvedValue({
      created: 1,
      transactionIds: ["tx-1"],
    });
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/finance")
      .set("x-role", UserRole.ACCOUNTANT)
      .set("x-permissions", CP_PERMISSION.API_LEDGER_POST)
      .set("x-org", "00000000-0000-0000-0000-000000000001")
      .send(validBody);

    expect(res.status).toBe(201);
    expect(service.importFinance).toHaveBeenCalledTimes(1);
  });

  it("allows isOwner even with empty permissions[]", async () => {
    service.importFinance.mockResolvedValue({
      created: 1,
      transactionIds: ["tx-1"],
    });
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/finance")
      .set("x-role", UserRole.USER)
      .set("x-permissions", "")
      .set("x-owner", "1")
      .send(validBody);
    expect(res.status).toBe(201);
  });

  it("returns 403 when ACCOUNTANT grants are stripped (empty permissions[])", async () => {
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/finance")
      .set("x-role", UserRole.ACCOUNTANT)
      .set("x-permissions", "")
      .send(validBody);
    expect(res.status).toBe(403);
    expect(service.importFinance).not.toHaveBeenCalled();
  });

  it("returns 403 when USER only has invoices.create", async () => {
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/finance")
      .set("x-role", UserRole.USER)
      .set("x-permissions", CP_PERMISSION.API_INVOICES_CREATE)
      .send(validBody);
    expect(res.status).toBe(403);
    expect(service.importFinance).not.toHaveBeenCalled();
  });

  it("returns 403 for PROCUREMENT purchases.manage without ledger.post", async () => {
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/finance")
      .set("x-role", UserRole.PROCUREMENT)
      .set("x-permissions", CP_PERMISSION.API_PURCHASES_MANAGE)
      .send(validBody);
    expect(res.status).toBe(403);
    expect(service.importFinance).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid DTO type when grant is present", async () => {
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/finance")
      .set("x-role", UserRole.ACCOUNTANT)
      .set("x-permissions", CP_PERMISSION.API_LEDGER_POST)
      .send([
        {
          accountCode: "101",
          amount: "not-a-number",
          currency: "AZN",
          date: "2026-04-27",
        },
      ]);
    expect(res.status).toBe(400);
    expect(service.importFinance).not.toHaveBeenCalled();
  });
});
