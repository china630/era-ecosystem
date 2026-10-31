import { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { UserRole } from "@erafinance/database";
import { CP_PERMISSION } from "@era/contracts";
import request from "supertest";
import type { NextFunction, Request, Response } from "express";
import { OpeningBalancesLegacyController } from "../../src/migration/migration.controller";
import { PermissionsGuard } from "../../src/common/guards/permissions.guard";

describe("Legacy opening-balances POST → 410 Gone", () => {
  jest.setTimeout(60_000);
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OpeningBalancesLegacyController],
      providers: [PermissionsGuard, Reflector],
    }).compile();

    app = moduleRef.createNestApplication();
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
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("finance returns 410 for ACCOUNTANT with assemble permission", async () => {
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/finance")
      .set("x-role", UserRole.ACCOUNTANT)
      .set("x-permissions", CP_PERMISSION.API_MIGRATION_ASSEMBLE)
      .send([]);
    expect(res.status).toBe(410);
  });

  it("hr returns 410", async () => {
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/hr")
      .set("x-owner", "1")
      .set("x-role", UserRole.OWNER)
      .send([]);
    expect(res.status).toBe(410);
  });

  it("inventory returns 410", async () => {
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/inventory")
      .set("x-owner", "1")
      .set("x-role", UserRole.OWNER)
      .send([]);
    expect(res.status).toBe(410);
  });
});
