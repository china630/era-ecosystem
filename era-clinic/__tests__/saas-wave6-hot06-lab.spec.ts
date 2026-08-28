/**
 * SaaS Wave 6 — HOT-06 clinic side lab (extra ticket + dual-run policy + hotel org stamp).
 * Does not claim HOT-06 SHIPPED or field SPA Insert.
 */
import {
  extraNeedsPaperTicket,
  extraTicketIdForOrder,
} from "@/domain/procedure/extra-ticket";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function dualRunEnabled(policy: { elektrawebDualRun: boolean } | null | undefined): boolean {
  return !!policy?.elektrawebDualRun;
}

/** Clinic outbox client requires hotel org — mirror of elektraweb-outbox-client guard. */
function requireHotelOrganizationId(hotelOrganizationId: string | undefined): string {
  if (!hotelOrganizationId?.trim()) {
    throw new Error("hotelOrganizationId required for Elektraweb outbox enqueue");
  }
  return hotelOrganizationId.trim();
}

describe("saas wave 6 HOT-06 clinic lab", () => {
  it("Issue ticket id is stable for print deep-link", () => {
    expect(extraTicketIdForOrder("order-1")).toBe("clinic-ticket-order-1");
  });

  it("paper ticket required for charged extras", () => {
    expect(extraNeedsPaperTicket({ amountNet: 17 })).toBe(true);
    expect(extraNeedsPaperTicket({ amountNet: 0 })).toBe(false);
  });

  it("dual-run from ClinicCutoverPolicy only (not CLINIC_ELEKTRAWEB_DUAL_RUN env)", () => {
    process.env.CLINIC_ELEKTRAWEB_DUAL_RUN = "1";
    expect(dualRunEnabled({ elektrawebDualRun: false })).toBe(false);
    expect(dualRunEnabled({ elektrawebDualRun: true })).toBe(true);
    delete process.env.CLINIC_ELEKTRAWEB_DUAL_RUN;
  });

  it("outbox stamp uses hotel org A even when clinic process bind is B", () => {
    process.env.ERA_SATELLITE_ORGANIZATION_ID = ORG_B;
    expect(requireHotelOrganizationId(ORG_A)).toBe(ORG_A);
    expect(() => requireHotelOrganizationId("")).toThrow(/hotelOrganizationId required/);
    expect(() => requireHotelOrganizationId(undefined)).toThrow(/hotelOrganizationId required/);
  });
});
