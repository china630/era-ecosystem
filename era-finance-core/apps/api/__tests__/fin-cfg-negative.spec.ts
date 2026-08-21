import { UnauthorizedException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { RuntimeConfigController } from "../src/control-plane/runtime-config.controller";
import { RuntimeConfigBodyDto } from "../src/control-plane/runtime-config.dto";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("Finance runtime-config negative paths (AC-FIN-CFG)", () => {
  const savedToken = process.env.SATELLITE_EVENT_SERVICE_TOKEN;
  const savedNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (savedToken === undefined) delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    else process.env.SATELLITE_EVENT_SERVICE_TOKEN = savedToken;
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
  });

  it("GET runtime-config without Bearer returns 401 when service token configured", async () => {
    process.env.NODE_ENV = "test";
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "cfg-secret-token";
    const ctrl = new RuntimeConfigController({} as PrismaService);
    await expect(ctrl.get(undefined, undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    try {
      await ctrl.get(undefined, undefined);
    } catch (err) {
      expect((err as UnauthorizedException).message).toMatch(/Unauthorized|token/i);
    }
  });

  it("GET runtime-config rejects wrong Bearer token", async () => {
    process.env.NODE_ENV = "test";
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "cfg-secret-token";
    const ctrl = new RuntimeConfigController({} as PrismaService);
    await expect(ctrl.get("Bearer wrong", undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects short ssoSharedSecret via RuntimeConfigBodyDto validation", async () => {
    const dto = plainToInstance(RuntimeConfigBodyDto, {
      ssoSharedSecret: "short",
    });
    const errors = await validate(dto);
    const ssoErr = errors.find((e) => e.property === "ssoSharedSecret");
    expect(ssoErr).toBeDefined();
    expect(Object.keys(ssoErr!.constraints ?? {}).length).toBeGreaterThan(0);
  });
});
