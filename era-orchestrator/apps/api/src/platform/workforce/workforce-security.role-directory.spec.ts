import { WorkforceSecurityService } from "./workforce-security.service";

describe("WorkforceSecurityService.roleDirectory", () => {
  const prisma = {
    workforceRoleBinding: { findMany: jest.fn() },
  };
  const entitlement = { assertWorkforceHub: jest.fn() };
  const catalog = { list: jest.fn() };
  const employments = { resolvePersonProfiles: jest.fn() };
  const svc = new WorkforceSecurityService(
    prisma as never,
    entitlement as never,
    {} as never,
    {} as never,
    employments as never,
    catalog as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("lists catalog roles and keeps a code that is only on a binding", async () => {
    catalog.list.mockResolvedValue([
      {
        satelliteKey: "industry_hotel_pms",
        code: "Housekeeper",
        name: "Housekeeper",
        active: true,
      },
    ]);
    prisma.workforceRoleBinding.findMany.mockResolvedValue([
      {
        employmentId: "emp-1",
        satelliteKey: "industry_hotel_pms",
        satelliteRole: "Housekeeper",
        source: "HIRE_DEFAULT",
        provisionState: "APPLIED",
        employment: {
          globalPersonId: "person-1",
          position: { name: "Maid" },
          orgUnit: { name: "Floor" },
        },
      },
      {
        employmentId: "emp-2",
        satelliteKey: "industry_hotel_pms",
        satelliteRole: "STAFF",
        source: "MANUAL_GRANT",
        provisionState: "APPLIED",
        employment: {
          globalPersonId: "person-2",
          position: { name: "Temp" },
          orgUnit: { name: "Floor" },
        },
      },
    ]);
    employments.resolvePersonProfiles.mockResolvedValue({});

    const out = await svc.roleDirectory("org-1");

    const housekeeper = out.roles.find((role) => role.code === "Housekeeper");
    const staff = out.roles.find((role) => role.code === "STAFF");
    expect(housekeeper?.holders).toHaveLength(1);
    expect(housekeeper?.holders[0]?.manual).toBe(false);
    expect(staff?.inCatalog).toBe(false);
    expect(staff?.holders[0]?.manual).toBe(true);
  });
});
