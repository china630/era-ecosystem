import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { OrgOperatingMode, UserRole } from "@era365/database";
import { WorkforceHoldingService } from "./workforce-holding.service";

const USER = "11111111-1111-4111-8111-111111111111";
const HOLDING = "22222222-2222-4222-8222-222222222222";
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORG_DEPT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PERSON = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const EMP_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const EMP_B = "ffffffff-ffff-4fff-8fff-ffffffffffff";

describe("WorkforceHoldingService", () => {
  const prisma: any = {
    holding: { findFirst: jest.fn() },
    organizationMembership: { findMany: jest.fn() },
    workforceEmployment: { findMany: jest.fn() },
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const employments = {
    resolvePersonProfiles: jest.fn(),
  };
  const mdm = {
    findPersonIdByFin: jest.fn().mockResolvedValue(null),
  };
  const svc = new WorkforceHoldingService(
    prisma,
    entitlement as never,
    employments as never,
    mdm as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    entitlement.assertWorkforceHub.mockResolvedValue(undefined);
    employments.resolvePersonProfiles.mockImplementation(
      async (_org: string, ids: string[]) => {
        const out: Record<string, { displayName: string; accessDenied: boolean }> =
          {};
        for (const id of ids) {
          out[id] = { displayName: "Ivanov", accessDenied: false };
        }
        return out;
      },
    );
  });

  function mockHoldingWithOrgs(
    orgs: Array<{ id: string; name: string; operatingMode: OrgOperatingMode }>,
  ) {
    prisma.holding.findFirst.mockResolvedValue({
      id: HOLDING,
      name: "Evrostar Group",
      organizations: orgs,
    });
  }

  it("HR only on A: directory does not include B employments", async () => {
    mockHoldingWithOrgs([
      { id: ORG_A, name: "Evrostar", operatingMode: OrgOperatingMode.STANDALONE },
      { id: ORG_B, name: "Group", operatingMode: OrgOperatingMode.STANDALONE },
    ]);
    prisma.organizationMembership.findMany.mockResolvedValue([
      {
        organization: {
          id: ORG_A,
          name: "Evrostar",
          operatingMode: OrgOperatingMode.STANDALONE,
        },
      },
    ]);
    prisma.workforceEmployment.findMany.mockResolvedValue([
      {
        id: EMP_A,
        organizationId: ORG_A,
        globalPersonId: PERSON,
        status: "ACTIVE",
        hireDate: new Date("2026-01-01"),
        orgUnit: { id: "u1", name: "Ops" },
        position: { id: "p1", name: "Cleaner" },
        organization: { id: ORG_A, name: "Evrostar" },
      },
    ]);

    const dir = await svc.directory(USER, ORG_A, HOLDING);
    expect(dir.visibleOrgs.map((o) => o.organizationId)).toEqual([ORG_A]);
    expect(prisma.workforceEmployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: { in: [ORG_A] },
        }),
      }),
    );
    expect(dir.items[0].employments).toHaveLength(1);
    expect(dir.items[0].employments[0].organizationId).toBe(ORG_A);
  });

  it("HR on A and B: one person row with two employments on card", async () => {
    mockHoldingWithOrgs([
      { id: ORG_A, name: "Evrostar", operatingMode: OrgOperatingMode.STANDALONE },
      { id: ORG_B, name: "Group", operatingMode: OrgOperatingMode.STANDALONE },
    ]);
    prisma.organizationMembership.findMany.mockResolvedValue([
      {
        organization: {
          id: ORG_A,
          name: "Evrostar",
          operatingMode: OrgOperatingMode.STANDALONE,
        },
      },
      {
        organization: {
          id: ORG_B,
          name: "Group",
          operatingMode: OrgOperatingMode.STANDALONE,
        },
      },
    ]);
    prisma.workforceEmployment.findMany
      .mockResolvedValueOnce([
        {
          id: EMP_A,
          organizationId: ORG_A,
          globalPersonId: PERSON,
          status: "ACTIVE",
          hireDate: new Date("2026-01-01"),
          orgUnit: { id: "u1", name: "Ops" },
          position: { id: "p1", name: "Cleaner" },
          organization: { id: ORG_A, name: "Evrostar" },
        },
        {
          id: EMP_B,
          organizationId: ORG_B,
          globalPersonId: PERSON,
          status: "ACTIVE",
          hireDate: new Date("2026-02-01"),
          orgUnit: { id: "u2", name: "Field" },
          position: { id: "p2", name: "Lead" },
          organization: { id: ORG_B, name: "Group" },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: EMP_A,
          organizationId: ORG_A,
          globalPersonId: PERSON,
          status: "ACTIVE",
          hireDate: new Date("2026-01-01"),
          orgUnit: { id: "u1", name: "Ops" },
          position: { id: "p1", name: "Cleaner" },
          organization: { id: ORG_A, name: "Evrostar" },
          roleBindings: [],
        },
        {
          id: EMP_B,
          organizationId: ORG_B,
          globalPersonId: PERSON,
          status: "ACTIVE",
          hireDate: new Date("2026-02-01"),
          orgUnit: { id: "u2", name: "Field" },
          position: { id: "p2", name: "Lead" },
          organization: { id: ORG_B, name: "Group" },
          roleBindings: [],
        },
      ]);

    const dir = await svc.directory(USER, ORG_A, HOLDING);
    expect(dir.items).toHaveLength(1);
    expect(dir.items[0].globalPersonId).toBe(PERSON);
    expect(dir.items[0].employments).toHaveLength(2);

    const card = await svc.personEmployments(USER, ORG_A, HOLDING, PERSON);
    expect(card.employments).toHaveLength(2);
    expect(card.employments.map((e) => e.organizationId).sort()).toEqual(
      [ORG_A, ORG_B].sort(),
    );
  });

  it("holding VIEWER without org HR → 403", async () => {
    mockHoldingWithOrgs([
      { id: ORG_A, name: "Evrostar", operatingMode: OrgOperatingMode.STANDALONE },
    ]);
    prisma.organizationMembership.findMany.mockResolvedValue([]);
    await expect(svc.resolveVisibleHrOrgs(USER, HOLDING)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("holding not found → 404", async () => {
    prisma.holding.findFirst.mockResolvedValue(null);
    await expect(svc.resolveVisibleHrOrgs(USER, HOLDING)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("DEPARTMENT child is not a second employer in visible orgs", async () => {
    mockHoldingWithOrgs([
      { id: ORG_A, name: "Evrostar", operatingMode: OrgOperatingMode.STANDALONE },
      {
        id: ORG_DEPT,
        name: "Clinic dept",
        operatingMode: OrgOperatingMode.DEPARTMENT,
      },
    ]);
    prisma.organizationMembership.findMany.mockImplementation(
      async (args: { where: { organizationId: { in: string[] } } }) => {
        expect(args.where.organizationId.in).toEqual([ORG_A]);
        expect(args.where.organizationId.in).not.toContain(ORG_DEPT);
        return [
          {
            organization: {
              id: ORG_A,
              name: "Evrostar",
              operatingMode: OrgOperatingMode.STANDALONE,
            },
          },
        ];
      },
    );
    const { orgs } = await svc.resolveVisibleHrOrgs(USER, HOLDING);
    expect(orgs.map((o) => o.organizationId)).toEqual([ORG_A]);
  });

  it("audit union resolves only HR-visible org ids", async () => {
    mockHoldingWithOrgs([
      { id: ORG_A, name: "Evrostar", operatingMode: OrgOperatingMode.STANDALONE },
      { id: ORG_B, name: "Group", operatingMode: OrgOperatingMode.STANDALONE },
    ]);
    prisma.organizationMembership.findMany.mockResolvedValue([
      {
        organization: {
          id: ORG_A,
          name: "Evrostar",
          operatingMode: OrgOperatingMode.STANDALONE,
        },
      },
    ]);
    const ids = await svc.resolveVisibleOrgIdsForAudit(USER, HOLDING);
    expect(ids).toEqual([ORG_A]);
    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          role: { in: [UserRole.OWNER, UserRole.HR_MANAGER] },
        }),
      }),
    );
  });

  it("entitlement uses a visible HR org when JWT org is outside intersection", async () => {
    mockHoldingWithOrgs([
      { id: ORG_A, name: "Evrostar", operatingMode: OrgOperatingMode.STANDALONE },
      { id: ORG_B, name: "Group", operatingMode: OrgOperatingMode.STANDALONE },
    ]);
    prisma.organizationMembership.findMany.mockResolvedValue([
      {
        organization: {
          id: ORG_B,
          name: "Group",
          operatingMode: OrgOperatingMode.STANDALONE,
        },
      },
    ]);
    prisma.workforceEmployment.findMany.mockResolvedValue([]);
    await svc.directory(USER, ORG_A, HOLDING);
    expect(entitlement.assertWorkforceHub).toHaveBeenCalledWith(ORG_B);
  });

  it("personEmployments without holdingId unions HR STANDALONE memberships", async () => {
    prisma.holding.findFirst.mockResolvedValue(null);
    prisma.organizationMembership.findMany.mockResolvedValue([
      {
        organization: {
          id: ORG_A,
          name: "Evrostar",
          operatingMode: OrgOperatingMode.STANDALONE,
        },
      },
      {
        organization: {
          id: ORG_B,
          name: "Group",
          operatingMode: OrgOperatingMode.STANDALONE,
        },
      },
    ]);
    prisma.workforceEmployment.findMany.mockResolvedValue([
      {
        id: EMP_A,
        organizationId: ORG_A,
        globalPersonId: PERSON,
        status: "ACTIVE",
        hireDate: new Date("2026-01-01"),
        orgUnit: { id: "u1", name: "Ops" },
        position: { id: "p1", name: "Cleaner" },
        organization: { id: ORG_A, name: "Evrostar" },
        roleBindings: [],
      },
      {
        id: EMP_B,
        organizationId: ORG_B,
        globalPersonId: PERSON,
        status: "ACTIVE",
        hireDate: new Date("2026-02-01"),
        orgUnit: { id: "u2", name: "Ops B" },
        position: { id: "p2", name: "Cleaner" },
        organization: { id: ORG_B, name: "Group" },
        roleBindings: [],
      },
    ]);
    const card = await svc.personEmployments(USER, ORG_A, null, PERSON);
    expect(prisma.holding.findFirst).not.toHaveBeenCalled();
    expect(card.holding).toBeNull();
    expect(card.employments).toHaveLength(2);
    expect(card.visibleOrgs.map((o) => o.organizationId).sort()).toEqual(
      [ORG_A, ORG_B].sort(),
    );
  });

  it("directory 1-char non-FIN q keeps all persons", async () => {
    mockHoldingWithOrgs([
      { id: ORG_A, name: "Evrostar", operatingMode: OrgOperatingMode.STANDALONE },
    ]);
    prisma.organizationMembership.findMany.mockResolvedValue([
      {
        organization: {
          id: ORG_A,
          name: "Evrostar",
          operatingMode: OrgOperatingMode.STANDALONE,
        },
      },
    ]);
    prisma.workforceEmployment.findMany.mockResolvedValue([
      {
        id: EMP_A,
        organizationId: ORG_A,
        globalPersonId: PERSON,
        status: "ACTIVE",
        hireDate: new Date("2026-01-01"),
        orgUnit: { id: "u1", name: "Ops" },
        position: { id: "p1", name: "Cleaner" },
        organization: { id: ORG_A, name: "Evrostar" },
      },
    ]);
    const dir = await svc.directory(USER, ORG_A, HOLDING, { q: "I" });
    expect(dir.items).toHaveLength(1);
    expect(mdm.findPersonIdByFin).not.toHaveBeenCalled();
  });
});

describe("hire remains org-scoped (RolesGuard contract)", () => {
  it("HireWorkforceEmploymentDto has no holdingId field", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");
    const src = fs.readFileSync(
      path.join(__dirname, "dto/workforce-provision.dto.ts"),
      "utf8",
    );
    expect(src).toMatch(/class HireWorkforceEmploymentDto/);
    expect(src).not.toMatch(/holdingId/);
  });
});
