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

  it("returns a cached person without reading MDM", async () => {
    const mdm = {
      globalNaturalPerson: { findUnique: jest.fn() },
      personAccessLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const row = {
      globalPersonId: "p1",
      displayName: "Aliyev Ali",
      firstName: "Ali",
      middleName: null,
      lastName: "Aliyev",
      primaryIdentifierMasked: "1****C4",
      accessDenied: false,
      sex: null,
      birthDate: null,
    };
    const cache = {
      read: jest.fn().mockResolvedValue(new Map([["p1", row]])),
      write: jest.fn(),
      forget: jest.fn(),
    };
    const service = new MdmService(mdm as never, {} as never, cache as never);
    const out = await service.batchGetPersonOpsProfile(["p1"], "org-1");
    expect(out.p1.displayName).toBe("Aliyev Ali");
    expect(out.p1.hrProfile).toBeNull();
    expect(mdm.globalNaturalPerson.findUnique).not.toHaveBeenCalled();
    expect(cache.write).not.toHaveBeenCalled();
    expect(mdm.personAccessLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "WORKFORCE_OPS_PROFILE_CACHE" }),
      }),
    );
  });

  it("still returns the cached person when the access log write fails", async () => {
    const mdm = {
      personAccessLog: { create: jest.fn().mockRejectedValue(new Error("log down")) },
    };
    const row = {
      globalPersonId: "p1",
      displayName: "Aliyev Ali",
      firstName: "Ali",
      middleName: null,
      lastName: "Aliyev",
      primaryIdentifierMasked: null,
      accessDenied: false,
      sex: null,
      birthDate: null,
    };
    const cache = {
      read: jest.fn().mockResolvedValue(new Map([["p1", row]])),
      write: jest.fn(),
      forget: jest.fn(),
    };
    const service = new MdmService(mdm as never, {} as never, cache as never);
    const out = await service.batchGetPersonOpsProfile(["p1"], "org-1");
    expect(out.p1.displayName).toBe("Aliyev Ali");
  });

  it("ensureWorkforceAccessGrant forgets that organization's snapshot", async () => {
    const mdm = {
      globalNaturalPerson: {
        findUnique: jest.fn().mockResolvedValue({ mergedIntoPersonId: null }),
      },
      personAccessGrant: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const cache = { read: jest.fn(), write: jest.fn(), forget: jest.fn() };
    const service = new MdmService(mdm as never, {} as never, cache as never);
    await service.ensureWorkforceAccessGrant("p1", "org-1");
    expect(cache.forget).toHaveBeenCalledWith("p1", "org-1");
  });
});
