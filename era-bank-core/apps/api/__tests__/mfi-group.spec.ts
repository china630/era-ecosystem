import { GroupMemberRole } from "@era/bank-core-database";
import { validateGroupMembershipBatch } from "../src/modules/mfi/mfi-group.util";

describe("MFI group membership (P1-2)", () => {
  const members = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      customerId: `cust-${i + 1}`,
      role:
        i === 0 ? GroupMemberRole.LEADER : GroupMemberRole.MEMBER,
    }));

  it("accepts a valid JLG-sized group with one leader", () => {
    expect(() => validateGroupMembershipBatch(members(5))).not.toThrow();
  });

  it("rejects duplicate customer ids", () => {
    expect(() =>
      validateGroupMembershipBatch([
        { customerId: "a", role: GroupMemberRole.LEADER },
        { customerId: "a", role: GroupMemberRole.MEMBER },
      ]),
    ).toThrow("Duplicate customerId");
  });

  it("requires exactly one leader before activation", () => {
    expect(() =>
      validateGroupMembershipBatch([
        { customerId: "a", role: GroupMemberRole.MEMBER },
        { customerId: "b", role: GroupMemberRole.MEMBER },
      ]),
    ).toThrow("exactly one LEADER");
  });
});