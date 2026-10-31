import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { OpeningBalancesLegacyController } from "../../src/migration/migration.controller";
import { PermissionsGuard } from "../../src/common/guards/permissions.guard";

describe("Migration opening-balances legacy Gone", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OpeningBalancesLegacyController],
    })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST finance returns 410", async () => {
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/finance")
      .send([]);
    expect(res.status).toBe(410);
  });

  it("POST hr returns 410", async () => {
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/hr")
      .send([]);
    expect(res.status).toBe(410);
  });

  it("POST inventory returns 410", async () => {
    const res = await request(app.getHttpServer())
      .post("/migration/opening-balances/inventory")
      .send([]);
    expect(res.status).toBe(410);
  });
});
