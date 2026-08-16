import { UnauthorizedException } from "@nestjs/common";
import { assertInternalServiceToken } from "./internal-service-token.util";

describe("assertInternalServiceToken", () => {
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

  it("accepts CONTROL_PLANE_SERVICE_TOKEN when the named env is unset (prod)", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN;
    process.env.CONTROL_PLANE_SERVICE_TOKEN = "cp-token";
    expect(() =>
      assertInternalServiceToken("Bearer cp-token"),
    ).not.toThrow();
  });

  it("rejects a mismatched token in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN;
    process.env.CONTROL_PLANE_SERVICE_TOKEN = "cp-token";
    expect(() => assertInternalServiceToken("Bearer other")).toThrow(
      UnauthorizedException,
    );
  });
});
