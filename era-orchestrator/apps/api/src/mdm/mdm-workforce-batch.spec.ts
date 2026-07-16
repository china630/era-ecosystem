import { BadRequestException } from "@nestjs/common";
import { MdmService } from "./mdm.service";

describe("MdmService workforce batch ops-profile", () => {
  it("compactWorkforceDisplay masks when accessDenied", () => {
    const service = new MdmService({} as never, {} as never);
    const row = service.compactWorkforceDisplay({
      globalPersonId: "p1",
      fullName: "Aliyev Ali",
      identifiers: [{ maskedValue: "1****C4", isPrimary: true }],
      accessDenied: true,
      hrProfile: null,
    });
    expect(row.displayName).toBeNull();
    expect(row.primaryIdentifierMasked).toBe("1****C4");
    expect(row.accessDenied).toBe(true);
    expect(row.hrProfile).toBeNull();
  });

  it("batchGetPersonOpsProfile requires organizationId", async () => {
    const service = new MdmService({} as never, {} as never);
    await expect(service.batchGetPersonOpsProfile(["p1"], "")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
