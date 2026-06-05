import { BadRequestException, NotFoundException } from "@nestjs/common";
import { OrgOperatingModeService } from "./org-operating-mode.service";
import {
  OrgOperatingModeDto,
  OrgRoutingDto,
} from "./dto/set-operating-mode.dto";

describe("OrgOperatingModeService", () => {
  const prisma = {
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  function svc() {
    return new OrgOperatingModeService(prisma as never);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.organization.update.mockImplementation(({ data, where }: any) =>
      Promise.resolve({
        id: where.id,
        operatingMode: data.operatingMode,
        parentOrgId: data.parentOrgId,
        fiscalRouting: data.fiscalRouting,
        revenueRouting: data.revenueRouting,
      }),
    );
  });

  it("STANDALONE clears parent and forces OWN routing", async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    const r = await svc().set("org-1", {
      mode: OrgOperatingModeDto.STANDALONE,
      parentOrgId: "ignored",
      fiscalRouting: OrgRoutingDto.PARENT,
    });
    expect(r.parentOrgId).toBeNull();
    expect(r.fiscalRouting).toBe(OrgRoutingDto.OWN);
    expect(r.revenueRouting).toBe(OrgRoutingDto.OWN);
  });

  it("DEPARTMENT requires parentOrgId", async () => {
    prisma.organization.findUnique.mockResolvedValueOnce({ id: "org-1" });
    await expect(
      svc().set("org-1", { mode: OrgOperatingModeDto.DEPARTMENT }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("DEPARTMENT rejects self as parent", async () => {
    prisma.organization.findUnique.mockResolvedValueOnce({ id: "org-1" });
    await expect(
      svc().set("org-1", {
        mode: OrgOperatingModeDto.DEPARTMENT,
        parentOrgId: "org-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("DEPARTMENT rejects a department parent (no chains)", async () => {
    prisma.organization.findUnique
      .mockResolvedValueOnce({ id: "org-1" })
      .mockResolvedValueOnce({ id: "hotel", operatingMode: "DEPARTMENT" });
    await expect(
      svc().set("org-1", {
        mode: OrgOperatingModeDto.DEPARTMENT,
        parentOrgId: "hotel",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("DEPARTMENT defaults routing to PARENT when valid", async () => {
    prisma.organization.findUnique
      .mockResolvedValueOnce({ id: "org-1" })
      .mockResolvedValueOnce({ id: "hotel", operatingMode: "STANDALONE" });
    const r = await svc().set("org-1", {
      mode: OrgOperatingModeDto.DEPARTMENT,
      parentOrgId: "hotel",
    });
    expect(r.mode).toBe(OrgOperatingModeDto.DEPARTMENT);
    expect(r.parentOrgId).toBe("hotel");
    expect(r.fiscalRouting).toBe(OrgRoutingDto.PARENT);
    expect(r.revenueRouting).toBe(OrgRoutingDto.PARENT);
  });

  it("detach flips a department back to standalone without data migration", async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    const r = await svc().detach("org-1");
    expect(r.mode).toBe(OrgOperatingModeDto.STANDALONE);
    expect(r.parentOrgId).toBeNull();
    expect(r.revenueRouting).toBe(OrgRoutingDto.OWN);
  });

  it("throws NotFound for unknown org", async () => {
    prisma.organization.findUnique.mockResolvedValue(null);
    await expect(svc().get("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
