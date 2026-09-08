import { UnauthorizedException } from "@nestjs/common";
import { MdmService } from "./mdm.service";

describe("Platform MDM negative paths (AC-CP-MDM)", () => {
  const prev = {
    named: process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN,
    cp: process.env.CONTROL_PLANE_SERVICE_TOKEN,
    nodeEnv: process.env.NODE_ENV,
  };

  afterEach(() => {
    restore("ORCHESTRATOR_INTERNAL_SERVICE_TOKEN", prev.named);
    restore("CONTROL_PLANE_SERVICE_TOKEN", prev.cp);
    if (prev.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev.nodeEnv;
  });

  function restore(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  it("assertServiceToken returns 401 when service token is missing", () => {
    process.env.NODE_ENV = "production";
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN = "mdm-svc-token";
    delete process.env.CONTROL_PLANE_SERVICE_TOKEN;
    const service = new MdmService({} as never, {} as never);
    expect(() => service.assertServiceToken(undefined)).toThrow(
      UnauthorizedException,
    );
    expect(() => service.assertServiceToken("")).toThrow(UnauthorizedException);
  });

  it("assertServiceToken returns 401 for wrong Bearer", () => {
    process.env.NODE_ENV = "production";
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN = "mdm-svc-token";
    const service = new MdmService({} as never, {} as never);
    expect(() => service.assertServiceToken("Bearer wrong")).toThrow(
      UnauthorizedException,
    );
  });

  it("assertServiceToken accepts SATELLITE_EVENT_SERVICE_TOKEN", () => {
    process.env.NODE_ENV = "production";
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN = "mdm-svc-token";
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "sat-token";
    const service = new MdmService({} as never, {} as never);
    expect(() => service.assertServiceToken("Bearer sat-token")).not.toThrow();
  });
});
