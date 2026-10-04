import { BadRequestException, ConflictException } from "@nestjs/common";
import { FnbEditionService } from "./fnb-edition.service";

type OrgRow = {
  subscriptionPlan: string | null;
  settings: Record<string, unknown>;
  activeModules: string[];
};

function build(org: OrgRow) {
  const audit: unknown[] = [];
  const tx = {
    organization: {
      update: jest.fn(async ({ data }: { data: Partial<OrgRow> }) => {
        Object.assign(org, data);
        return org;
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: { data: unknown }) => {
        audit.push(data);
        return data;
      }),
    },
  };
  const prisma = {
    organization: { findUnique: jest.fn(async () => ({ ...org })) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const access = { assertOwnerForBilling: jest.fn(async () => undefined) };
  const bindSync = { syncForOrg: jest.fn(async () => undefined) };
  const service = new FnbEditionService(prisma as never, access as never, bindSync as never);
  return { service, audit, access, bindSync, org };
}

describe("FnbEditionService", () => {
  it("upgrades Kafe to full F&B without touching hotel mode or signup source", async () => {
    const { service, audit, bindSync, org } = build({
      subscriptionPlan: "kafe",
      settings: { edition: "kafe", signupSource: "kafe", hotelMode: false },
      activeModules: ["industry_fnb_pos", "fnb_waiter_pin"],
    });
    const res = await service.upgradeToFull("u1", "org1");
    expect(res).toEqual({ hasFnb: true, edition: "fnb", canUpgrade: false, synced: true });
    expect(org.subscriptionPlan).toBe("fnb");
    expect(org.settings).toEqual({ edition: "fnb", signupSource: "kafe", hotelMode: false });
    expect(org.activeModules).toEqual(["industry_fnb_pos", "fnb_waiter_pin"]);
    expect(audit).toHaveLength(1);
    expect(bindSync.syncForOrg).toHaveBeenCalledWith("org1");
  });

  it("rejects an org that is already on full F&B", async () => {
    const { service } = build({
      subscriptionPlan: "fnb",
      settings: { edition: "fnb", signupSource: "kafe" },
      activeModules: ["industry_fnb_pos"],
    });
    await expect(service.upgradeToFull("u1", "org1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects an org without the F&B satellite", async () => {
    const { service } = build({
      subscriptionPlan: "kafe",
      settings: { edition: "kafe" },
      activeModules: [],
    });
    await expect(service.upgradeToFull("u1", "org1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("reports a failed runtime-config push without undoing the upgrade", async () => {
    const { service, bindSync, org } = build({
      subscriptionPlan: "kafe",
      settings: { edition: "kafe", signupSource: "kafe" },
      activeModules: ["industry_fnb_pos"],
    });
    bindSync.syncForOrg.mockRejectedValueOnce(new Error("pool down"));
    const res = await service.upgradeToFull("u1", "org1");
    expect(res.synced).toBe(false);
    expect(org.settings.edition).toBe("fnb");
  });

  it("owner check runs before reading state", async () => {
    const { service, access } = build({
      subscriptionPlan: "kafe",
      settings: {},
      activeModules: ["industry_fnb_pos"],
    });
    access.assertOwnerForBilling.mockRejectedValueOnce(new Error("BILLING_OWNER_ONLY"));
    await expect(service.state("u2", "org1")).rejects.toThrow("BILLING_OWNER_ONLY");
  });
});
