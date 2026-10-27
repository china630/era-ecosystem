import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { OrgOperatingMode } from "@era365/database";
import { OrganizationProfileService } from "./organization-profile.service";

describe("OrganizationProfileService", () => {
  const orgId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const parentId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const userId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  function makePrisma(overrides: Record<string, unknown> = {}) {
    return {
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: "m1" }),
      },
      organization: {
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: orgId }),
      },
      organizationProfile: {
        upsert: jest.fn().mockResolvedValue({ organizationId: orgId }),
      },
      organizationContactChannel: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      organizationAddress: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          organizationContactChannel: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
          organizationAddress: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        }),
      ),
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      ...overrides,
    } as unknown as ConstructorParameters<typeof OrganizationProfileService>[0];
  }

  it("rejects a second primary PHONE", async () => {
    const prisma = makePrisma();
    const svc = new OrganizationProfileService(prisma as never);
    await expect(
      svc.patchProfile(orgId, userId, {
        contacts: [
          {
            kind: "PHONE",
            value: "+994501111111",
            purpose: "GENERAL",
            isPrimary: true,
            sortOrder: 0,
          },
          {
            kind: "PHONE",
            value: "+994502222222",
            purpose: "PRINT",
            isPrimary: true,
            sortOrder: 1,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects non-+994 phone", async () => {
    const prisma = makePrisma();
    const svc = new OrganizationProfileService(prisma as never);
    await expect(
      svc.patchProfile(orgId, userId, {
        contacts: [
          {
            kind: "PHONE",
            value: "0501111111",
            purpose: "GENERAL",
            isPrimary: true,
            sortOrder: 0,
          },
        ],
      }),
    ).rejects.toMatchObject({ response: { code: "INVALID_PHONE" } });
  });

  it("forbids non-members", async () => {
    const prisma = makePrisma({
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });
    const svc = new OrganizationProfileService(prisma as never);
    await expect(svc.assertOrgMember(userId, orgId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("DEPARTMENT inherits parent phone when own contacts empty", async () => {
    const prisma = makePrisma({
      organization: {
        findFirst: jest.fn().mockResolvedValue({
          id: orgId,
          name: "Clinic Dept",
          currency: "AZN",
          taxIdCipher: null,
          operatingMode: OrgOperatingMode.DEPARTMENT,
          parentOrgId: parentId,
          profile: {
            organizationId: orgId,
            tradeName: null,
            nameAz: null,
            nameRu: null,
            nameEn: null,
            directorName: null,
            directorTitle: null,
            logoUrl: null,
            stampUrl: null,
            signatureDirectorUrl: null,
            bankLine: null,
            updatedAt: new Date("2026-10-27T00:00:00.000Z"),
            contacts: [],
            addresses: [],
          },
          parentOrg: {
            id: parentId,
            name: "Hotel LLC",
            taxIdCipher: null,
            profile: {
              organizationId: parentId,
              tradeName: null,
              logoUrl: "https://cdn.example/logo.png",
              bankLine: "Kapital BANK IBAN",
              contacts: [
                {
                  id: "c1",
                  kind: "PHONE",
                  value: "+994121111111",
                  label: null,
                  purpose: "GENERAL",
                  isPrimary: true,
                  sortOrder: 0,
                },
              ],
              addresses: [
                {
                  id: "a1",
                  kind: "LEGAL",
                  line1: "Baku",
                  line2: null,
                  city: null,
                  region: null,
                  postalCode: null,
                  country: "AZ",
                  lineAz: null,
                  lineRu: null,
                  lineEn: null,
                  isPrimary: true,
                  sortOrder: 0,
                },
              ],
            },
          },
        }),
      },
    });
    const svc = new OrganizationProfileService(prisma as never);
    const snap = await svc.getSnapshot(orgId);
    expect(snap.print["org.phone"]).toBe("+994121111111");
    expect(snap.print["org.logoUrl"]).toBe("https://cdn.example/logo.png");
    expect(snap.inheritedFromParent?.logoUrl).toBe(true);
  });

  it("own DEPARTMENT phone wins over parent", async () => {
    const prisma = makePrisma({
      organization: {
        findFirst: jest.fn().mockResolvedValue({
          id: orgId,
          name: "Clinic Dept",
          currency: "AZN",
          taxIdCipher: null,
          operatingMode: OrgOperatingMode.DEPARTMENT,
          parentOrgId: parentId,
          profile: {
            organizationId: orgId,
            tradeName: null,
            nameAz: null,
            nameRu: null,
            nameEn: null,
            directorName: null,
            directorTitle: null,
            logoUrl: null,
            stampUrl: null,
            signatureDirectorUrl: null,
            bankLine: null,
            updatedAt: new Date("2026-10-27T00:00:00.000Z"),
            contacts: [
              {
                id: "c2",
                kind: "PHONE",
                value: "+994501234567",
                label: "reception",
                purpose: "GENERAL",
                isPrimary: true,
                sortOrder: 0,
              },
            ],
            addresses: [],
          },
          parentOrg: {
            id: parentId,
            name: "Hotel LLC",
            taxIdCipher: null,
            profile: {
              organizationId: parentId,
              contacts: [
                {
                  id: "c1",
                  kind: "PHONE",
                  value: "+994121111111",
                  label: null,
                  purpose: "GENERAL",
                  isPrimary: true,
                  sortOrder: 0,
                },
              ],
              addresses: [],
              logoUrl: null,
              bankLine: null,
            },
          },
        }),
      },
    });
    const svc = new OrganizationProfileService(prisma as never);
    const snap = await svc.getSnapshot(orgId);
    expect(snap.print["org.phone"]).toBe("+994501234567");
  });
});
