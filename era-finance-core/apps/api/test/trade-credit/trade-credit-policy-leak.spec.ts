import {
  TradeCreditFacilityStatus,
  TradeCreditPolicyGroup,
} from "@erafinance/database";
import {
  TradeCreditService,
  type TradeCreditFacilityView,
  type TradeCreditStaffFacilityView,
} from "../../src/trade-credit/trade-credit.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { SubscriptionAccessService } from "../../src/subscription/subscription-access.service";
import type { TradeCreditPolicyService } from "../../src/trade-credit/trade-credit-policy.service";

/** Wholesale / satellite outbound shape — never spreads Finance staff DTO. */
function wholesaleCreditOutbound(facility: {
  creditLimit: number;
  available: number;
  stopList: boolean;
  policyGroup?: string | null;
  policyReasons?: string[];
  proposedLimit?: number | null;
}) {
  return {
    creditLimit: facility.creditLimit,
    available: facility.available,
    stopList: facility.stopList,
  };
}

const POLICY_LEAK_KEYS = [
  "policyGroup",
  "policyGroupComputed",
  "policyGroupManual",
  "policyReasons",
  "proposedLimit",
  "proposedAt",
  "proposedKind",
  "suggestedLimit",
  "limitBeforeBlock",
  "autoRaiseMuted",
] as const;

describe("Trade credit policy DTO leak (Phase 1)", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const cpId = "22222222-2222-4222-8222-222222222222";
  const facilityId = "33333333-3333-4333-8333-333333333333";

  function makeSvc() {
    const facility = {
      id: facilityId,
      organizationId: orgId,
      counterpartyId: cpId,
      creditLimit: 5000,
      stopList: false,
      status: TradeCreditFacilityStatus.ACTIVE,
      policyGroup: TradeCreditPolicyGroup.A,
      policyGroupManual: null,
      policyReasonsJson: ["willingness_high", "ability_high"],
      proposedLimit: 6000,
      proposedAt: new Date("2026-09-01T00:00:00.000Z"),
      proposedKind: "WORKING_CAPITAL",
      suggestedLimit: 5800,
      limitBeforeBlock: null,
      autoRaiseMuted: false,
    };

    const policy = {
      effectiveGroup: jest.fn().mockReturnValue("A"),
      scheduleReclassify: jest.fn(),
    } as unknown as TradeCreditPolicyService;

    const prisma = {
      counterparty: {
        findFirst: jest.fn().mockResolvedValue({ id: cpId }),
      },
      tradeCreditFacility: {
        findUnique: jest.fn().mockResolvedValue(facility),
      },
      tradeCreditGrant: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;

    const subscription = {
      hasModule: jest.fn().mockResolvedValue(true),
    } as unknown as SubscriptionAccessService;

    const svc = new TradeCreditService(prisma, subscription, policy, {
      maybeNotifyGrantExpired: jest.fn(),
    } as never);
    return { svc, facility };
  }

  it("getFacilityView keys exclude policy fields", async () => {
    const { svc } = makeSvc();
    const view: TradeCreditFacilityView = await svc.getFacilityView(orgId, cpId);

    for (const key of POLICY_LEAK_KEYS) {
      expect(view).not.toHaveProperty(key);
      expect(Object.prototype.hasOwnProperty.call(view, key)).toBe(false);
    }
    expect(Object.keys(view).sort()).toEqual(
      [
        "available",
        "counterpartyId",
        "creditLimit",
        "facilityId",
        "openAr",
        "status",
        "stopList",
        "unusedIssuedGrants",
      ].sort(),
    );
  });

  it("getStaffFacilityView includes policyGroup", async () => {
    const { svc } = makeSvc();
    const staff: TradeCreditStaffFacilityView = await svc.getStaffFacilityView(
      orgId,
      cpId,
    );

    expect(staff.policyGroup).toBe("A");
    expect(staff.policyGroupComputed).toBe("A");
    expect(staff.policyReasons).toEqual(["willingness_high", "ability_high"]);
    expect(staff.proposedLimit).toBe(6000);
    expect(staff.proposedKind).toBe("WORKING_CAPITAL");
    expect(staff.suggestedLimit).toBe(5800);
  });

  it("wholesale-shaped snapshot never carries policyGroup", () => {
    const staffLike = {
      creditLimit: 8000,
      available: 2500,
      stopList: false,
      policyGroup: "D",
      policyReasons: ["max_dpd"],
      proposedLimit: 9000,
      proposedKind: "WORKING_CAPITAL",
      suggestedLimit: 8500,
    };
    const outbound = wholesaleCreditOutbound(staffLike);
    expect(outbound).toEqual({
      creditLimit: 8000,
      available: 2500,
      stopList: false,
    });
    expect(outbound).not.toHaveProperty("policyGroup");
    expect(outbound).not.toHaveProperty("policyReasons");
    expect(outbound).not.toHaveProperty("proposedLimit");
    expect(outbound).not.toHaveProperty("proposedKind");
    expect(outbound).not.toHaveProperty("suggestedLimit");
  });
});
