import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { MdmService } from "./mdm.service";

describe("MdmService.lookupNaturalPersonByFin", () => {
  it("rejects invalid FIN format", async () => {
    const service = new MdmService({} as never, {} as never);
    await expect(
      service.lookupNaturalPersonByFin({ fin: "TOO-SHORT" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("assertServiceToken rejects missing bearer", () => {
    const service = new MdmService({} as never, {} as never);
    const prev = process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN;
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN = "secret-token";
    try {
      expect(() => service.assertServiceToken(undefined)).toThrow(
        UnauthorizedException,
      );
      expect(() => service.assertServiceToken("Bearer wrong")).toThrow(
        UnauthorizedException,
      );
      expect(() => service.assertServiceToken("Bearer secret-token")).not.toThrow();
    } finally {
      if (prev === undefined) {
        delete process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN;
      } else {
        process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN = prev;
      }
    }
  });
});
